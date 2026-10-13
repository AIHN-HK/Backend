import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { LocalBackendFixture } from './support/local-backend-fixture';

jest.setTimeout(120000);
describe('built AppModule HTTP contract with isolated DB/Redis', () => {
  const fixture = new LocalBackendFixture();
  let token: string;
  let otherSession: number;
  beforeAll(async () => {
    await fixture.start();
    const owners = await Promise.all(
      [1, 2].map((index) =>
        fixture.prisma.user.create({
          data: {
            email: `e2e-${index}@example.test`,
            fullname: 'E2E owner',
            password: 'unused',
            yob: new Date('2009-01-01'),
          },
        }),
      ),
    );
    token = new JwtService({ secret: fixture.secret }).sign({
      userId: owners[0].id,
    });
    const attempt = await fixture.prisma.attempt.create({
      data: { userId: owners[1].id, totalQuestions: 0 },
    });
    otherSession = (
      await fixture.prisma.chatSession.create({
        data: {
          userId: owners[1].id,
          attemptId: attempt.id,
          socketId: 'fixture',
        },
      })
    ).id;
  });
  afterAll(async () => fixture.stop());
  it('serves public liveness and readiness through the real prefix/envelope', async () => {
    const live = await request(fixture.origin)
      .get('/api/v1/health')
      .timeout(5000)
      .expect(200);
    expect(live.body.data.status).toBe('ok');
    expect(live.headers['x-request-id']).toBeTruthy();
    const ready = await request(fixture.origin)
      .get('/api/v1/health/ready')
      .timeout(5000)
      .expect(200);
    expect(ready.body.data).toEqual({
      status: 'ready',
      checks: { database: true, redis: true },
    });
  });
  it('rejects unauthenticated private requests', async () => {
    await request(fixture.origin)
      .get('/api/v1/users/me')
      .timeout(5000)
      .expect(401);
  });
  it('rejects malformed input before persistence', async () => {
    const response = await request(fixture.origin)
      .post('/api/v1/answer/submit-v2')
      .auth(token, { type: 'bearer' })
      .send({ attemptId: 1, answers: [{ questionId: 1, check: 'false' }] })
      .timeout(5000)
      .expect(400);
    expect(response.body.message).toBe('Validation failed');
    expect(await fixture.prisma.answer.count()).toBe(0);
  });
  it('denies another owner session without exposing messages', async () => {
    const response = await request(fixture.origin)
      .get(`/api/v1/chat/sessions/${otherSession}/messages`)
      .auth(token, { type: 'bearer' })
      .timeout(5000)
      .expect(403);
    expect(response.body).not.toHaveProperty('data');
  });
});
