/** Owned local DB/Redis/AI fixtures; never sends data to an external AI service. */
import 'dotenv/config';
import assert = require('node:assert/strict');
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createWriteStream, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import WebSocket = require('ws');
import { io, Socket } from 'socket.io-client';
import Queue = require('bull');
import { ConfigService } from '@nestjs/config';
import { ChatTurnService } from '../src/modules/chat/chat-turn.service';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
async function until(check: () => Promise<boolean>, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error('Local smoke timed out');
}
function socketEvent(socket: Socket, name: string, action: () => void) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, receive);
      reject(new Error('Socket event timed out: ' + name));
    }, 10000);
    const receive = (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(name, receive);
    action();
  });
}
async function stop(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) =>
    child.once('exit', () => resolve()),
  );
  child.kill('SIGTERM');
  let forced = false;
  const timer = setTimeout(() => {
    forced = true;
    child.kill('SIGKILL');
  }, 6000);
  await exited;
  clearTimeout(timer);
  assert.equal(forced, false, 'Owned process failed graceful shutdown');
}

async function main() {
  const sourceUrl = new URL(process.env.DATABASE_URL!);
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(sourceUrl.hostname),
    'Local PostgreSQL required',
  );
  const databaseName = 'aihn_be_' + randomUUID().replaceAll('-', '');
  const fixtureUrl = new URL(sourceUrl);
  fixtureUrl.pathname = '/' + databaseName;
  const master = new PrismaClient({
    datasources: { db: { url: sourceUrl.toString() } },
  });
  const prisma = new PrismaClient({
    datasources: { db: { url: fixtureUrl.toString() } },
  });
  const directory = mkdtempSync(join(tmpdir(), 'aihn-be-live-'));
  const log = createWriteStream(join(directory, 'application.log'));
  let databaseCreated = false;
  let redisProcess: ChildProcess;
  let app: ChildProcess;
  let redis: Redis;
  let socket: Socket;
  let ai: WebSocket.Server;
  let queue: Queue.Queue;
  let stalledQueue: Queue.Queue;
  let stalledWorker: ChildProcess;
  const aiInputs: any[] = [];
  try {
    await master.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const migration = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: fixtureUrl.toString() },
        encoding: 'utf8',
      },
    );
    assert.equal(migration.status, 0, 'Isolated migration deployment failed');
    const redisPort = await freePort();
    const redisPassword = randomUUID();
    redisProcess = spawn(
      'redis-server',
      [
        '--bind',
        '127.0.0.1',
        '--port',
        String(redisPort),
        '--requirepass',
        redisPassword,
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        directory,
      ],
      { stdio: 'ignore' },
    );
    redis = new Redis({
      host: '127.0.0.1',
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: 1,
    });
    redis.on('error', () => {});
    await until(async () => {
      try {
        return (await redis.ping()) === 'PONG';
      } catch {
        return false;
      }
    });
    queue = new Queue('ai-chat-queue', {
      redis: { host: '127.0.0.1', port: redisPort, password: redisPassword },
    });
    const turns = new ChatTurnService(
      redis,
      new ConfigService({ CHAT_TURN_LEASE_MS: 3000 }),
    );
    const firstTurn = await turns.reserve(999);
    await assert.rejects(() => turns.reserve(999));
    await turns.cancel(999);
    assert.equal(await turns.isCurrent(999, firstTurn), false);
    await turns.release(999, firstTurn);
    const newerTurn = await turns.reserve(999);
    await turns.release(999, firstTurn);
    assert.equal(await turns.isCurrent(999, newerTurn), true);
    assert.equal(await turns.renew(999, firstTurn), 0);
    assert.equal(await turns.renew(999, newerTurn), 1);
    await turns.release(999, newerTurn);
    const stalledName = 'crash-fixture-' + randomUUID();
    stalledQueue = new Queue(stalledName, {
      redis: { host: '127.0.0.1', port: redisPort, password: redisPassword },
      settings: {
        maxStalledCount: 0,
        lockDuration: 1000,
        stalledInterval: 500,
      },
    });
    stalledWorker = spawn(
      process.execPath,
      [
        '-e',
        "const Queue=require('bull'); const q=new Queue(process.env.FIXTURE_QUEUE,{redis:{host:'127.0.0.1',port:Number(process.env.FIXTURE_PORT),password:process.env.FIXTURE_PASSWORD},settings:{maxStalledCount:0,lockDuration:1000,stalledInterval:500}}); q.process(()=>{ process.send('active'); return new Promise(()=>{}); });",
      ],
      {
        env: {
          ...process.env,
          FIXTURE_QUEUE: stalledName,
          FIXTURE_PORT: String(redisPort),
          FIXTURE_PASSWORD: redisPassword,
        },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      },
    );
    const workerClaim = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Crash fixture worker did not start')),
        10000,
      );
      stalledWorker.once('message', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    const crashJob = await stalledQueue.add(
      { message: 'fixture' },
      { attempts: 1 },
    );
    await workerClaim;
    const crashed = new Promise<void>((resolve) =>
      stalledWorker.once('exit', () => resolve()),
    );
    stalledWorker.kill('SIGKILL');
    await crashed;
    let replays = 0;
    void stalledQueue
      .process(async () => {
        replays++;
      })
      .catch(() => undefined);
    await until(async () => (await crashJob.getState()) === 'failed', 10000);
    assert.equal(replays, 0);
    await stalledQueue.close();
    console.log(
      'PASS real Bull worker crash: uncertain turn fails without stalled-job replay.',
    );
    ai = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve) => ai.once('listening', resolve));
    ai.on('connection', (connection) => {
      connection.on('message', (raw) => {
        const input = JSON.parse(raw.toString());
        aiInputs.push(input);
        setTimeout(() => {
          if (connection.readyState !== WebSocket.OPEN) return;
          if (input.message === 'FAIL') {
            connection.send('not-json');
            return;
          }
          connection.send(
            JSON.stringify({ type: 'token', content: 'Fixture answer' }),
          );
          if (input.message !== 'STOP')
            connection.send(JSON.stringify({ type: 'end' }));
        }, 100);
      });
    });
    const port = await freePort();
    const secret = randomUUID();
    const origin = `http://127.0.0.1:${port}`;
    app = spawn(process.execPath, ['dist/src/main'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        DATABASE_URL: fixtureUrl.toString(),
        JWT_ACCESS_SECRET: secret,
        JWT_REFRESH_SECRET: randomUUID(),
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: String(redisPort),
        REDIS_PASSWORD: redisPassword,
        AI_WS_URL: `ws://127.0.0.1:${(ai.address() as { port: number }).port}`,
        AI_CONNECT_TIMEOUT_MS: '1000',
        AI_IDLE_TIMEOUT_MS: '2000',
        AI_MAX_DURATION_MS: '4000',
        CORS_ORIGINS: origin,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    app.stdout.pipe(log);
    app.stderr.pipe(log);
    await until(async () => {
      try {
        return (await fetch(origin + '/api/v1/health/ready')).status === 200;
      } catch {
        return false;
      }
    }, 20000);
    const jwt = new JwtService({ secret });
    const users = await Promise.all(
      ['USER', 'ADMIN', 'USER'].map((role, index) =>
        prisma.user.create({
          data: {
            role,
            email: `fixture-${index}@example.test`,
            fullname: 'Local fixture',
            password: 'unused-fixture-hash',
            yob: new Date('2009-01-01'),
          },
        }),
      ),
    );
    const [owner, admin, other] = users;
    const tokens = users.map((user) => jwt.sign({ userId: user.id }));
    const request = async (
      path: string,
      options: RequestInit = {},
      token = tokens[0],
    ) => {
      const response = await fetch(origin + '/api/v1' + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          ...options.headers,
        },
      });
      return {
        status: response.status,
        body: (await response.json()) as any,
        requestId: response.headers.get('x-request-id'),
      };
    };
    const priorities = ['R', 'I', 'A', 'S', 'E', 'C'].map((type, i) => ({
      type,
      priority: i + 1,
    }));
    await prisma.priority.createMany({ data: priorities });
    await prisma.question.createMany({
      data: [
        { content: 'R fixture', type: 'R', dimension: 'PERSONA' },
        { content: 'I fixture', type: 'I', dimension: 'INTEREST' },
      ],
    });
    const questions = await prisma.question.findMany({
      orderBy: { id: 'asc' },
    });
    const start = async () => {
      const response = await request('/test-session', { method: 'POST' });
      assert.equal(response.status, 201);
      return response.body.data.id as number;
    };
    const payload = (attemptId: number) => ({
      attemptId,
      answers: questions.map((question, index) => ({
        questionId: question.id,
        check: index === 0,
      })),
    });
    const attemptId = await start();
    assert.equal(
      (
        await request('/answer/submit-v2', {
          method: 'POST',
          body: JSON.stringify({
            attemptId,
            answers: [
              { questionId: questions[0].id, check: 'false' },
              { questionId: questions[1].id, check: true },
            ],
          }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          '/answer/submit-v2',
          { method: 'POST', body: JSON.stringify(payload(attemptId)) },
          tokens[2],
        )
      ).status,
      403,
    );
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        request('/answer/submit-v2', {
          method: 'POST',
          body: JSON.stringify(payload(attemptId)),
        }),
      ),
    );
    assert.deepEqual(
      concurrent.map((result) => result.status).sort(),
      [201, 409],
    );
    assert.equal(
      (await prisma.result.findUniqueOrThrow({ where: { attemptId } })).scoreI,
      0,
    );
    assert.ok(await prisma.snapShot.findUnique({ where: { attemptId } }));
    assert.equal(await prisma.answer.count({ where: { attemptId } }), 2);
    assert.ok(concurrent.find((response) => response.status === 201).requestId);
    await redis.set(
      `history:${owner.id}:first`,
      JSON.stringify({ formattedHistory: [{ attemptId: -1 }] }),
    );
    assert.equal(
      (await request('/test-session/history-by-user?limit=1')).body.data
        .formattedHistory.length,
      1,
    );
    const second = await start();
    assert.equal(
      (
        await request('/answer/submit-v2', {
          method: 'POST',
          body: JSON.stringify(payload(second)),
        })
      ).status,
      201,
    );
    assert.equal(
      (await request('/test-session/history-by-user?limit=2')).body.data
        .formattedHistory.length,
      2,
    );
    assert.equal(
      (await request('/test-session/history-by-user?limit=-1')).status,
      400,
    );
    assert.equal(
      (await request('/test-session/history-by-user?cursorId=1')).status,
      400,
    );
    const rollback = await start();
    await prisma.snapShot.create({
      data: { attemptId: rollback, snapshot: {} },
    });
    assert.equal(
      (
        await request('/answer/submit-v2', {
          method: 'POST',
          body: JSON.stringify(payload(rollback)),
        })
      ).status,
      409,
    );
    assert.equal(
      await prisma.answer.count({ where: { attemptId: rollback } }),
      0,
    );
    assert.equal(
      await prisma.result.count({ where: { attemptId: rollback } }),
      0,
    );
    assert.equal(
      (await prisma.attempt.findUniqueOrThrow({ where: { id: rollback } }))
        .finishAt,
      null,
    );
    await prisma.snapShot.delete({ where: { attemptId: rollback } });
    await prisma.attempt.delete({ where: { id: rollback } });
    console.log(
      'PASS local HTTP/PostgreSQL: strict boolean, ownership, concurrent completion, atomic snapshot rollback, current history, bounded pagination.',
    );

    const adminBody = {
      content: 'Audited question',
      type: 'A',
      dimension: 'ABILITY',
    };
    const created = await request(
      '/question',
      { method: 'POST', body: JSON.stringify(adminBody) },
      tokens[1],
    );
    assert.equal(created.status, 201);
    const audit = await prisma.adminAuditLog.findFirstOrThrow({
      where: { entity: 'Question' },
    });
    assert.equal(audit.actorId, admin.id);
    assert.equal((audit.after as any).content, adminBody.content);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "fixture_audit_failure" CHECK ("action" <> 'created') NOT VALID`,
    );
    const before = await prisma.question.count();
    assert.equal(
      (
        await request(
          '/question',
          {
            method: 'POST',
            body: JSON.stringify({ ...adminBody, content: 'Must roll back' }),
          },
          tokens[1],
        )
      ).status,
      500,
    );
    assert.equal(await prisma.question.count(), before);
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminAuditLog" DROP CONSTRAINT "fixture_audit_failure"',
    );
    assert.equal(
      (
        await request(
          '/admin/priorities',
          {
            method: 'PUT',
            body: JSON.stringify({
              priorities: priorities.map((row, i) => ({
                ...row,
                priority: 6 - i,
              })),
            }),
          },
          tokens[1],
        )
      ).status,
      200,
    );
    assert.ok(
      await prisma.adminAuditLog.findFirst({
        where: { entity: 'Priority', actorId: admin.id },
      }),
    );
    const bulk = await request(
      '/question/bulk',
      {
        method: 'POST',
        body: JSON.stringify({
          questions: [{ content: 'R fixture', type: 'R' }],
        }),
      },
      tokens[1],
    );
    assert.equal(bulk.status, 201);
    assert.equal(bulk.body.data.data.length, 1);
    const bulkAudit = await prisma.adminAuditLog.findFirstOrThrow({
      where: { action: 'bulk-created' },
    });
    assert.equal((bulkAudit.after as any[]).length, 1);
    assert.notEqual((bulkAudit.after as any[])[0].id, questions[0].id);
    const topcode = {
      code: 'R',
      title: 'Before',
      personality: ['p'],
      strengths: ['s'],
      weaknesses: ['w'],
      careers: ['c'],
    };
    await prisma.topCode.create({ data: topcode });
    assert.equal(
      (
        await request(
          '/topcode',
          {
            method: 'PUT',
            body: JSON.stringify({ ...topcode, title: 'After' }),
          },
          tokens[1],
        )
      ).status,
      200,
    );
    const topAudit = await prisma.adminAuditLog.findFirstOrThrow({
      where: { entity: 'TopCode' },
    });
    assert.equal(topAudit.actorId, admin.id);
    assert.equal((topAudit.before as any).title, 'Before');
    assert.equal((topAudit.after as any).title, 'After');
    console.log(
      'PASS admin audit: authenticated actor, public change data, audit failure rolls back mutation.',
    );

    socket = io(origin, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
      auth: { token: tokens[0] },
    });
    const connected = await socketEvent(socket, 'connected', () =>
      socket.connect(),
    );
    const sessionId = connected.sessionId;
    const denied = await prisma.chatSession.create({
      data: { userId: other.id, attemptId, socketId: 'other' },
    });
    await socketEvent(socket, 'error', () =>
      socket.emit('ask', { sessionId: denied.id, content: 'denied' }),
    );
    assert.equal(aiInputs.length, 0);
    const normalEnd = socketEvent(socket, 'answer_end', () => {});
    const busy = socketEvent(socket, 'error', () => {});
    const queued = await socketEvent(socket, 'queue_joined', () => {
      socket.emit('ask', { sessionId, content: 'NORMAL' });
      socket.emit('ask', { sessionId, content: 'NORMAL' });
    });
    assert.equal((await busy).code, 'CHAT_BUSY');
    assert.equal((await normalEnd).status, 'completed');
    assert.equal(aiInputs.length, 1);
    assert.equal(
      await prisma.chatMessage.count({
        where: { sessionId, role: 'assistant' },
      }),
      1,
    );
    const failureEnd = socketEvent(socket, 'answer_end', () => {});
    const failedJob = await socketEvent(socket, 'queue_joined', () =>
      socket.emit('ask', { sessionId, content: 'FAIL' }),
    );
    assert.equal((await failureEnd).status, 'failed');
    await until(
      async () =>
        (await (await queue.getJob(failedJob.turnId)).getState()) === 'failed',
    );
    assert.equal(
      (
        await prisma.chatMessage.findFirstOrThrow({
          where: { sessionId, content: 'FAIL' },
        })
      ).checkpoint,
      0,
    );
    const recoveryEnd = socketEvent(socket, 'answer_end', () => {});
    await socketEvent(socket, 'queue_joined', () =>
      socket.emit('ask', { sessionId, content: 'RECOVER' }),
    );
    assert.equal((await recoveryEnd).status, 'completed');
    assert.ok(
      aiInputs.at(-1).history.some((message) => message.content === 'FAIL'),
    );
    assert.equal(
      (
        await prisma.chatMessage.findFirstOrThrow({
          where: { sessionId, content: 'FAIL' },
        })
      ).checkpoint,
      1,
    );
    const stoppedToken = socketEvent(socket, 'answer_token', () => {});
    await socketEvent(socket, 'queue_joined', () =>
      socket.emit('ask', { sessionId, content: 'STOP' }),
    );
    await stoppedToken;
    await socketEvent(socket, 'generation_stopped', () =>
      socket.emit('stop_generation', { sessionId }),
    );
    await until(async () => !(await redis.get(`chat:turn:${sessionId}`)));
    assert.equal(
      await prisma.chatMessage.count({
        where: { sessionId, role: 'assistant' },
      }),
      2,
    );
    assert.equal(
      (
        await prisma.chatMessage.findFirstOrThrow({
          where: { sessionId, content: 'STOP' },
        })
      ).checkpoint,
      0,
    );
    assert.equal((await request('/health/ready')).status, 200);
    await queue.pause();
    const beforeQueuedStop = aiInputs.length;
    const pausedJob = await socketEvent(socket, 'queue_joined', () =>
      socket.emit('ask', { sessionId, content: 'QUEUED' }),
    );
    await socketEvent(socket, 'generation_stopped', () =>
      socket.emit('stop_generation', { sessionId }),
    );
    assert.equal(await queue.getJob(pausedJob.turnId), null);
    assert.equal(await redis.get(`chat:turn:${sessionId}`), null);
    await queue.resume();
    await delay(150);
    assert.equal(aiInputs.length, beforeQueuedStop);
    console.log(
      'PASS real Socket.IO/Bull/authenticated Redis/local fake AI: busy session, completed/failed/cancelled turns, queued cancellation, lease ownership, checkpoint recovery, no automatic replay.',
    );
    assert.ok(queued.turnId);
    await redis.call('CLIENT', 'PAUSE', '3000', 'ALL');
    assert.equal((await request('/health/ready')).status, 503);
    await until(async () => (await request('/health/ready')).status === 200);
    console.log('PASS readiness dependency failure/recovery.');
  } finally {
    socket?.disconnect();
    await stop(app);
    if (ai) {
      for (const connection of ai.clients) connection.terminate();
      await new Promise<void>((resolve) => ai.close(() => resolve()));
    }
    await queue?.close();
    await stop(stalledWorker);
    await stalledQueue?.close();
    redis?.disconnect();
    await stop(redisProcess);
    await prisma.$disconnect();
    if (databaseCreated)
      await master.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await master.$disconnect();
    log.end();
    console.log(
      'Owned local test database removed and processes stopped. Logs:',
      directory,
    );
  }
}

main().catch((error) => {
  console.error('Local backend smoke failed', {
    name: error.name,
    location: error.stack
      ?.split('\n')
      .find((line: string) => line.includes('backend-fixes-live-smoke.ts')),
  });
  process.exitCode = 1;
});
