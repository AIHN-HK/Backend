/** Real Socket.IO + local PostgreSQL + JWT; AI queue is captured, never processed. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert = require('node:assert/strict');
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bull';
import { ChatGateway } from '../src/modules/chat/chat.gateway';
import { ChatService } from '../src/modules/chat/chat.service';
import { PrismaService } from '../src/core/database/prisma.service';
import { ChatTurnService } from '../src/modules/chat/chat-turn.service';
const updateSocketAuth = (socket: any, token: string) => {
  socket.auth = { token };
  socket.emit('refresh_auth', { token });
};
import { io } from 'socket.io-client';
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    throw Error('Local DB required');
  const prisma = new PrismaClient();
  const emails = [
    `w02-socket-${randomUUID()}@example.test`,
    `w02-socket-${randomUUID()}@example.test`,
  ];
  let app: any;
  let socket: any;
  let queued = 0;
  const jwt = new JwtService({ secret: 'local-socket-smoke-only' });
  const event = (name: string, action: () => void) =>
    new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(name, receive);
        reject(Error(`Timed out: ${name}`));
      }, 5000);
      const receive = (value: any) => {
        clearTimeout(timer);
        resolve(value);
      };
      socket.once(name, receive);
      action();
    });
  try {
    const users = await Promise.all(
      emails.map((email) =>
        prisma.user.create({
          data: {
            email,
            fullname: 'Socket Test',
            password: randomUUID(),
            yob: new Date('2009-01-01'),
          },
        }),
      ),
    );
    await prisma.attempt.create({
      data: {
        userId: users[0].id,
        totalQuestions: 0,
        finishAt: new Date(),
        result: {
          create: {
            scoreR: 0,
            scoreI: 0,
            scoreA: 0,
            scoreS: 0,
            scoreE: 0,
            scoreC: 0,
            topCode: 'RIA',
          },
        },
      },
    });
    const service = new ChatService(
      prisma as any,
      { stopGeneration: () => {} } as any,
      {} as any,
    );
    const mod = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatTurnService,
          useValue: {
            reserve: async () => randomUUID(),
            release: async () => {},
          },
        },
        { provide: ChatService, useValue: service },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: getQueueToken('ai-chat-queue'),
          useValue: {
            add: async () => {
              queued++;
            },
          },
        },
      ],
    }).compile();
    app = mod.createNestApplication();
    await app.listen(0, '127.0.0.1');
    socket = io(await app.getUrl(), {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
      auth: { token: jwt.sign({ userId: users[0].id }, { expiresIn: 2 }) },
    });
    const connected = await event('connected', () => socket.connect());
    const sessionId = connected.sessionId;
    const other = await prisma.chatSession.create({
      data: {
        userId: users[1].id,
        attemptId: connected.attemptId,
        socketId: 'other',
      },
    });
    await event('error', () =>
      socket.emit('ask', { sessionId: other.id, content: 'denied' }),
    );
    assert.equal(queued, 0);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await event('error', () =>
      socket.emit('ask', { sessionId, content: 'expired' }),
    );
    assert.equal(queued, 0);
    const fresh = jwt.sign({ userId: users[0].id }, { expiresIn: 600 });
    await event('auth_refreshed', () => updateSocketAuth(socket, fresh));
    await event('queue_joined', () =>
      socket.emit('ask', { sessionId, content: 'fresh' }),
    );
    assert.equal(queued, 1);
    assert.equal(
      (await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } }))
        .id,
      sessionId,
    );
    await event('error', () =>
      updateSocketAuth(socket, jwt.sign({ userId: users[1].id })),
    );
    await event('queue_joined', () =>
      socket.emit('ask', { sessionId, content: 'still owned' }),
    );
    assert.equal(queued, 2);
    console.log(
      'PASS real Socket.IO/PostgreSQL/JWT: cross-user session denied, expired JWT denied, fresh token resumes same session, account-switch renewal rejected. AI queue captured only.',
    );
  } finally {
    socket?.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await app?.close();
    const ids = (
      await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      })
    ).map((u) => u.id);
    await prisma.chatSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.result.deleteMany({
      where: { attempt: { userId: { in: ids } } },
    });
    await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error('Socket smoke failed', {
    name: error.name,
    line: error.stack
      ?.split('\n')
      .find((line: string) => line.includes('socket-live-smoke.ts')),
  });
  process.exitCode = 1;
});
