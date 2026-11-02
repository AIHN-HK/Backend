import { createHmac } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import WebSocket = require('ws');
import { io, Socket } from 'socket.io-client';
import { LocalBackendFixture } from './support/local-backend-fixture';
import { importCareerData } from '../scripts/import-career-data';
import { codes } from '../src/modules/career/domain/scoring';

jest.setTimeout(180000);
describe('career journey against migrated PostgreSQL, Redis, Bull and local AI protocol', () => {
  let fixture: LocalBackendFixture, ai: WebSocket.Server, socket: Socket;
  let access: string,
    otherAccess: string,
    owner: number,
    attemptId: number,
    runId: string;
  const contexts: any[] = [];
  beforeAll(async () => {
    ai = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve) => ai.once('listening', resolve));
    ai.on('connection', (connection) =>
      connection.once('message', (raw) => {
        contexts.push(JSON.parse(raw.toString()));
        connection.send(JSON.stringify({ type: 'start' }));
        connection.send(
          JSON.stringify({
            type: 'token',
            content: 'Local protocol fixture answer',
          }),
        );
        connection.send(JSON.stringify({ type: 'end' }));
      }),
    );
    fixture = new LocalBackendFixture(undefined, {
      AI_WS_URL: `ws://127.0.0.1:${(ai.address() as { port: number }).port}`,
    });
    await fixture.start();
    await importCareerData(fixture.prisma);
    await fixture.prisma.priority.createMany({
      data: codes.map((type, i) => ({ type, priority: i + 1 })),
    });
    await fixture.prisma.question.createMany({
      data: codes.flatMap((type) =>
        Array.from({ length: 18 }, (_, i) => ({
          content: `Fixture ${type} ${i}`,
          type,
          dimension: 'INTEREST' as const,
        })),
      ),
    });
    for (const code of codes)
      await fixture.prisma.topCode.create({
        data: {
          code,
          title: `Fixture ${code}`,
          personality: [],
          strengths: [],
          weaknesses: [],
          careers: [],
        },
      });
    const other = await fixture.prisma.user.create({
      data: {
        email: 'other@example.test',
        fullname: 'Other fixture',
        password: 'unused',
        yob: new Date('2009-01-01'),
      },
    });
    otherAccess = new JwtService({ secret: fixture.secret }).sign({
      userId: other.id,
    });
  });
  afterAll(async () => {
    socket?.disconnect();
    if (ai) {
      for (const c of ai.clients) c.terminate();
      await new Promise<void>((resolve) => ai.close(() => resolve()));
    }
    await fixture?.stop();
  });
  it('registers with hashed one-use OTP and logs in through the public auth contract', async () => {
    const email = 'journey@example.test',
      code = '234567';
    await fixture.prisma.otp.create({
      data: {
        email,
        code: createHmac('sha256', fixture.secret)
          .update(JSON.stringify([email, 'REGISTER', code]))
          .digest('hex'),
        type: 'REGISTER',
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const input = {
      email,
      password: 'Fixture-password-123',
      fullname: 'Journey fixture',
      phone: '0901234567',
      yob: '2009-11-30',
      otpCode: code,
    };
    await request(fixture.origin)
      .post('/api/v1/auth/register')
      .send({ ...input, otpCode: '000000' })
      .expect(401);
    const registered = await request(fixture.origin)
      .post('/api/v1/auth/register')
      .send(input)
      .expect(201);
    owner = registered.body.data.user.id;
    const login = await request(fixture.origin)
      .post('/api/v1/auth/login')
      .send({ email, password: input.password })
      .expect(201);
    access = login.body.data.accessToken;
    expect(
      (await fixture.prisma.otp.findFirstOrThrow({ where: { email } })).used,
    ).toBe(true);
    expect(JSON.stringify(registered.body)).not.toContain(input.password);
  });
  it('completes all 108 boolean fixture questions and reads owned result/history', async () => {
    const attempt = await request(fixture.origin)
      .post('/api/v1/test-session')
      .auth(access, { type: 'bearer' })
      .send({})
      .expect(201);
    attemptId = attempt.body.data.id;
    expect(attempt.body.data.totalQuestions).toBe(108);
    const questions = await fixture.prisma.question.findMany({
      orderBy: { id: 'asc' },
    });
    const body = {
      attemptId,
      answers: questions.map((q, i) => ({
        questionId: q.id,
        check: q.type === 'I' || i % 5 === 0,
      })),
    };
    await request(fixture.origin)
      .post('/api/v1/answer/submit-v2')
      .auth(otherAccess, { type: 'bearer' })
      .send(body)
      .expect(403);
    await request(fixture.origin)
      .post('/api/v1/answer/submit-v2')
      .auth(access, { type: 'bearer' })
      .send(body)
      .expect(201);
    await request(fixture.origin)
      .get(`/api/v1/result/${attemptId}`)
      .auth(access, { type: 'bearer' })
      .expect(200);
    await request(fixture.origin)
      .get(`/api/v1/result/${attemptId}suffix`)
      .auth(access, { type: 'bearer' })
      .expect(400);
    await request(fixture.origin)
      .get(`/api/v1/result/${attemptId}`)
      .auth(otherAccess, { type: 'bearer' })
      .expect(404);
    const history = await request(fixture.origin)
      .get('/api/v1/test-session/history-by-user')
      .auth(access, { type: 'bearer' })
      .expect(200);
    expect(history.body.data.formattedHistory[0].attemptId).toBe(attemptId);
  });
  it('persists profile with concurrency control and immutable explained recommendations', async () => {
    const payload = {
      revision: 0,
      skills: [{ skillId: '2.B.3.e', level: 0 }],
      interests: { R: 0, I: 5, A: 2, S: 1, E: 1, C: 3 },
      targetCareerId: '15-1252.00',
    };
    await request(fixture.origin)
      .put('/api/v1/career/profile')
      .auth(access, { type: 'bearer' })
      .send(payload)
      .expect(200);
    await request(fixture.origin)
      .put('/api/v1/career/profile')
      .auth(access, { type: 'bearer' })
      .send(payload)
      .expect(409);
    const response = await request(fixture.origin)
      .post('/api/v1/career/recommendations')
      .auth(access, { type: 'bearer' })
      .send({ attemptId })
      .expect(201);
    runId = response.body.data.id;
    expect(response.body.data.items).toHaveLength(20);
    for (const row of response.body.data.items) {
      expect(row.score).toBeCloseTo(
        row.contributions.reduce(
          (sum: number, c: any) => sum + c.contribution,
          0,
        ),
      );
      expect(row.sourceVersion).toBe('O*NET 31.0');
    }
    await request(fixture.origin)
      .get(`/api/v1/career/recommendations/${runId}`)
      .auth(otherAccess, { type: 'bearer' })
      .expect(404);
    await request(fixture.origin)
      .post('/api/v1/career/recommendations')
      .auth(otherAccess, { type: 'bearer' })
      .send({ attemptId })
      .expect(404);
  });
  it('derives gaps, creates an owned phased roadmap and preserves evidence on regeneration', async () => {
    const gap = await request(fixture.origin)
      .get('/api/v1/career/gaps/15-1252.00')
      .auth(access, { type: 'bearer' })
      .expect(200);
    expect(
      gap.body.data.gaps.some((g: any) => g.current === null && g.gap === null),
    ).toBe(true);
    const response = await request(fixture.origin)
      .post('/api/v1/career/goals')
      .auth(access, { type: 'bearer' })
      .send({ careerId: '15-1252.00' })
      .expect(201);
    let goal = response.body.data;
    await request(fixture.origin)
      .post('/api/v1/career/goals')
      .auth(access, { type: 'bearer' })
      .send({ careerId: '15-1252.00' })
      .expect(409);
    const later = goal.tasks.find((t: any) => t.phase === 3);
    await request(fixture.origin)
      .patch(`/api/v1/career/goals/${goal.id}/tasks/${later.id}`)
      .auth(access, { type: 'bearer' })
      .send({ revision: goal.revision, done: true, evidence: 'premature' })
      .expect(409);
    const first = goal.tasks[0];
    await request(fixture.origin)
      .patch(`/api/v1/career/goals/${goal.id}/tasks/${first.id}`)
      .auth(otherAccess, { type: 'bearer' })
      .send({ revision: goal.revision, done: true, evidence: 'wrong owner' })
      .expect(404);
    const updated = await request(fixture.origin)
      .patch(`/api/v1/career/goals/${goal.id}/tasks/${first.id}`)
      .auth(access, { type: 'bearer' })
      .send({
        revision: goal.revision,
        done: true,
        evidence: 'Read work activities and recorded reflections',
      })
      .expect(200);
    await request(fixture.origin)
      .patch(`/api/v1/career/goals/${goal.id}/tasks/${first.id}`)
      .auth(access, { type: 'bearer' })
      .send({ revision: goal.revision, done: false, evidence: '' })
      .expect(409);
    goal = updated.body.data;
    const regenerated = await request(fixture.origin)
      .post(`/api/v1/career/goals/${goal.id}/regenerate`)
      .auth(access, { type: 'bearer' })
      .send({ revision: goal.revision })
      .expect(201);
    expect(
      regenerated.body.data.tasks.find((t: any) => t.id === first.id),
    ).toMatchObject({
      done: true,
      evidence: 'Read work activities and recorded reflections',
    });
    const other = await request(fixture.origin)
      .get('/api/v1/career/goals')
      .auth(otherAccess, { type: 'bearer' })
      .expect(200);
    expect(other.body.data).toEqual([]);
  });
  it('reports real analytics and enforces DB-authoritative admin publishing with audit', async () => {
    const analytics = await request(fixture.origin)
      .get('/api/v1/career/analytics')
      .auth(access, { type: 'bearer' })
      .expect(200);
    expect(analytics.body.data.counts.assessments).toBe(1);
    expect(analytics.body.data.delta).toBeNull();
    expect(analytics.body.data.goals[0].completed).toBe(1);
    await request(fixture.origin)
      .get('/api/v1/admin/career-analytics')
      .auth(access, { type: 'bearer' })
      .expect(403);
    const admin = await fixture.prisma.user.create({
      data: {
        email: 'admin-career@example.test',
        fullname: 'Admin fixture',
        role: 'ADMIN',
        password: 'unused',
        yob: new Date('2000-01-01'),
      },
    });
    const adminToken = new JwtService({ secret: fixture.secret }).sign({
      userId: admin.id,
    });
    const detail = await request(fixture.origin)
      .get('/api/v1/careers/15-1252.00')
      .expect(200);
    const revision = detail.body.data.revision;
    await importCareerData(fixture.prisma);
    expect(
      (
        await fixture.prisma.career.findUniqueOrThrow({
          where: { id: '15-1252.00' },
        })
      ).revision,
    ).toBe(revision);
    await request(fixture.origin)
      .patch('/api/v1/admin/career-data/15-1252.00')
      .auth(adminToken, { type: 'bearer' })
      .send({ revision, active: false })
      .expect(200);
    await request(fixture.origin).get('/api/v1/careers/15-1252.00').expect(404);
    const saved = await request(fixture.origin)
      .get(`/api/v1/career/recommendations/${runId}`)
      .auth(access, { type: 'bearer' })
      .expect(200);
    expect(saved.body.data.items.length).toBe(20);
    expect(
      await fixture.prisma.adminAuditLog.count({
        where: { actorId: admin.id, entity: 'Career' },
      }),
    ).toBe(1);
    await request(fixture.origin)
      .patch('/api/v1/admin/career-data/15-1252.00')
      .auth(adminToken, { type: 'bearer' })
      .send({ revision: revision + 1, active: true })
      .expect(200);
    const stats = await request(fixture.origin)
      .get('/api/v1/admin/career-analytics')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(stats.body.data.careers).toBe(923);
  });
  it('preserves conversation memory through two Socket.IO/Bull/AI turns and saved history', async () => {
    socket = io(fixture.origin, {
      auth: { token: access },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    const session: any = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 10000);
      socket.once('connected', (value) => {
        clearTimeout(t);
        resolve(value);
      });
      socket.connect();
    });
    expect(session.userID).toBe(owner);
    for (const content of [
      'First fixture question',
      'Second fixture question',
    ]) {
      const terminal: any = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('turn timeout')), 15000);
        socket.once('answer_end', (value) => {
          clearTimeout(t);
          resolve(value);
        });
        socket.emit('ask', { sessionId: session.sessionId, content });
      });
      expect(terminal.status).toBe('completed');
    }
    expect(
      contexts[1].history.some(
        (m: any) =>
          m.role === 'assistant' &&
          m.content === 'Local protocol fixture answer',
      ),
    ).toBe(true);
    expect(JSON.stringify(contexts)).not.toMatch(
      /Fixture-password|accessToken|refreshToken|journey@example/,
    );
    expect(contexts[1].profile_json.career_context.target.id).toBe(
      '15-1252.00',
    );
    expect(contexts[1].profile_json.career_context.recommendation.id).toBe(
      runId,
    );
    expect(contexts[1].profile_json.career_context.roadmaps[0].completed).toBe(
      1,
    );
    const history = await request(fixture.origin)
      .get(`/api/v1/chat/sessions/${session.sessionId}/messages`)
      .auth(access, { type: 'bearer' })
      .expect(200);
    expect(history.body.data).toHaveLength(4);
    await request(fixture.origin)
      .get(`/api/v1/chat/sessions/${session.sessionId}/messages`)
      .auth(otherAccess, { type: 'bearer' })
      .expect(403);
  });
});
