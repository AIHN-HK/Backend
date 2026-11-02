import { spawnSync } from 'node:child_process';
import request = require('supertest');
import * as bcrypt from 'bcrypt';
import { LocalBackendFixture } from './support/local-backend-fixture';
import { seedDatabase } from '../prisma/seed';
import { seedReferenceData } from '../prisma/seed-reference';
import {
  demoAccounts,
  defaultDemoPassword,
  seedDemoData,
} from '../prisma/seed-demo';

jest.setTimeout(180000);
describe('seed against a migrated isolated PostgreSQL database and real API', () => {
  let fixture: LocalBackendFixture;
  let studentToken: string;
  let demo: Awaited<ReturnType<typeof seedDemoData>>;
  beforeAll(async () => {
    fixture = new LocalBackendFixture(undefined, { AI_WS_URL: '' });
    await fixture.start();
  });
  afterAll(async () => {
    await fixture?.stop();
  });
  const counts = async () => ({
    users: await fixture.prisma.user.count(),
    questions: await fixture.prisma.question.count(),
    careers: await fixture.prisma.career.count(),
    skills: await fixture.prisma.skill.count(),
    attempts: await fixture.prisma.attempt.count(),
    answers: await fixture.prisma.answer.count(),
    results: await fixture.prisma.result.count(),
    snapshots: await fixture.prisma.snapShot.count(),
    runs: await fixture.prisma.recommendationRun.count(),
    goals: await fixture.prisma.careerGoal.count(),
    tasks: await fixture.prisma.goalTask.count(),
    sessions: await fixture.prisma.chatSession.count(),
    messages: await fixture.prisma.chatMessage.count(),
  });

  it('fills an empty DB with real reference data and no accounts by default', async () => {
    const result = await seedDatabase(fixture.prisma);
    expect(result.reference).toMatchObject({
      questions: 108,
      questionsAdded: 108,
      topCodes: 6,
      priorities: 6,
    });
    expect(result.careers).toMatchObject({
      careers: 923,
      skills: 35,
      version: 'O*NET 31.0',
    });
    expect(await fixture.prisma.user.count()).toBe(0);
    const catalog = await request(fixture.origin)
      .get('/api/v1/careers?limit=1&page=1')
      .expect(200);
    expect(catalog.body.data.total).toBe(923);
    const guest = await request(fixture.origin)
      .get('/api/v1/guest-assessment/catalog')
      .expect(200);
    expect(guest.body.data.questions).toHaveLength(108);
  });

  it('repairs partial reference data without replacing edited content or priorities', async () => {
    const question = await fixture.prisma.question.findFirstOrThrow();
    await fixture.prisma.question.delete({ where: { id: question.id } });
    await fixture.prisma.priority.delete({ where: { type: 'C' } });
    await fixture.prisma.priority.update({
      where: { type: 'R' },
      data: { priority: 6 },
    });
    await fixture.prisma.topCode.update({
      where: { code: 'I' },
      data: { title: 'Edited by admin' },
    });
    const result = await seedReferenceData(fixture.prisma);
    expect(result.questionsAdded).toBe(1);
    expect(result.questions).toBe(108);
    expect(
      (await fixture.prisma.topCode.findUniqueOrThrow({ where: { code: 'I' } }))
        .title,
    ).toBe('Edited by admin');
    expect(
      (
        await fixture.prisma.priority.findUniqueOrThrow({
          where: { type: 'R' },
        })
      ).priority,
    ).toBe(6);
    expect(
      new Set((await fixture.prisma.priority.findMany()).map((p) => p.priority))
        .size,
    ).toBe(6);
    await Promise.all([
      seedReferenceData(fixture.prisma),
      seedReferenceData(fixture.prisma),
    ]);
    expect(await fixture.prisma.question.count()).toBe(108);
  });

  it('rolls back new users, answers and attempts when no published career can be seeded', async () => {
    const before = await counts();
    await fixture.prisma.career.updateMany({ data: { active: false } });
    try {
      await expect(seedDemoData(fixture.prisma)).rejects.toThrow(
        'Import a published career catalog',
      );
      expect(await counts()).toEqual(before);
    } finally {
      await fixture.prisma.career.updateMany({ data: { active: true } });
    }
  });

  it('creates a coherent labeled demo journey with real results, ranking and roadmap', async () => {
    demo = await seedDemoData(fixture.prisma);
    expect(await counts()).toMatchObject({
      users: 2,
      attempts: 2,
      answers: 216,
      results: 2,
      snapshots: 2,
      runs: 1,
      goals: 1,
      sessions: 1,
      messages: 2,
    });
    const user = await fixture.prisma.user.findUniqueOrThrow({
      where: { email: demoAccounts[0].email },
    });
    expect(await bcrypt.compare(defaultDemoPassword, user.password)).toBe(true);
    for (const account of demoAccounts) {
      const response = await request(fixture.origin)
        .post('/api/v1/auth/login')
        .send({ email: account.email, password: defaultDemoPassword })
        .expect(201);
      expect(response.body.data.user.role).toBe(account.role);
      if (account.role === 'USER')
        studentToken = response.body.data.accessToken;
    }
    const history = await request(fixture.origin)
      .get('/api/v1/test-session/history-by-user')
      .auth(studentToken, { type: 'bearer' })
      .expect(200);
    expect(history.body.data.formattedHistory).toHaveLength(2);
    for (const id of demo.attemptIds) {
      await request(fixture.origin)
        .get(`/api/v1/result/${id}`)
        .auth(studentToken, { type: 'bearer' })
        .expect(200);
      const snapshot = await fixture.prisma.snapShot.findUniqueOrThrow({
        where: { attemptId: id },
      });
      const data = snapshot.snapshot as {
        questions: { answerValue: number }[];
      };
      expect(data.questions).toHaveLength(108);
      expect(
        data.questions.every((q) => q.answerValue === 0 || q.answerValue === 1),
      ).toBe(true);
    }
    const run = await request(fixture.origin)
      .get('/api/v1/career/recommendations/latest')
      .auth(studentToken, { type: 'bearer' })
      .expect(200);
    expect(run.body.data.items).toHaveLength(20);
    expect(run.body.data.items[0].sourceVersion).toBe('O*NET 31.0');
    expect(run.body.data.items[0].contributions.length).toBeGreaterThan(0);
    const goals = await request(fixture.origin)
      .get('/api/v1/career/goals')
      .auth(studentToken, { type: 'bearer' })
      .expect(200);
    expect(goals.body.data[0].tasks.filter((t) => t.done)).toHaveLength(1);
    expect(goals.body.data[0].tasks[0].evidence).toContain('[DEMO]');
    const chat = await request(fixture.origin)
      .get(`/api/v1/chat/sessions/${demo.chatSessionId}/messages`)
      .auth(studentToken, { type: 'bearer' })
      .expect(200);
    expect(JSON.stringify(chat.body.data)).toContain(
      'không phải phản hồi từ dịch vụ AI',
    );
  });

  it('repeated and concurrent seeds preserve IDs, user data and existing progress', async () => {
    const goal = await fixture.prisma.careerGoal.findFirstOrThrow({
      where: { userId: demo.studentId },
      include: { tasks: true },
    });
    await fixture.prisma.goalTask.update({
      where: { id: goal.tasks[0].id },
      data: { evidence: '[DEMO] Edited evidence' },
    });
    await fixture.prisma.careerProfile.update({
      where: { userId: demo.studentId },
      data: {
        skills: [{ skillId: '2.B.3.e', level: 4 }],
        revision: { increment: 1 },
      },
    });
    await fixture.prisma.career.update({
      where: { id: '15-1252.00' },
      data: { active: false },
    });
    const before = await counts();
    const result = await seedDatabase(fixture.prisma, { demo: true });
    expect(result.reference.questionsAdded).toBe(0);
    expect(result.demo.attemptIds).toEqual(demo.attemptIds);
    expect(result.demo.recommendationId).toBe(demo.recommendationId);
    await Promise.all([
      seedDemoData(fixture.prisma),
      seedDemoData(fixture.prisma),
    ]);
    expect(await counts()).toEqual(before);
    expect(
      (
        await fixture.prisma.goalTask.findUniqueOrThrow({
          where: { id: goal.tasks[0].id },
        })
      ).evidence,
    ).toBe('[DEMO] Edited evidence');
    expect(
      (
        await fixture.prisma.careerProfile.findUniqueOrThrow({
          where: { userId: demo.studentId },
        })
      ).revision,
    ).toBe(2);
    expect(
      (
        await fixture.prisma.career.findUniqueOrThrow({
          where: { id: '15-1252.00' },
        })
      ).active,
    ).toBe(false);
  });

  it('runs the real setup and compiled Prisma seed commands against this isolated DB', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = '/' + fixture.databaseName;
    const env = {
      ...process.env,
      DATABASE_URL: url.toString(),
      NODE_ENV: 'development',
      SEED_DEMO_PASSWORD: '',
    };
    const setup = spawnSync('pnpm', ['run', 'setup:demo'], {
      env,
      encoding: 'utf8',
      timeout: 120000,
    });
    expect({
      status: setup.status,
      error: setup.status ? setup.stderr : '',
    }).toEqual({ status: 0, error: '' });
    const seed = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'db', 'seed'],
      { env, encoding: 'utf8', timeout: 120000 },
    );
    expect({
      status: seed.status,
      error: seed.status ? seed.stderr : '',
    }).toEqual({ status: 0, error: '' });
    expect(await counts()).toMatchObject({
      users: 2,
      questions: 108,
      careers: 923,
      attempts: 2,
      runs: 1,
      goals: 1,
    });
  });

  it('does not promote a conflicting account or reset a changed password', async () => {
    await fixture.prisma.user.update({
      where: { email: demoAccounts[1].email },
      data: { role: 'USER' },
    });
    await expect(seedDemoData(fixture.prisma)).rejects.toThrow(
      'refusing to replace',
    );
    expect(
      (
        await fixture.prisma.user.findUniqueOrThrow({
          where: { email: demoAccounts[1].email },
        })
      ).role,
    ).toBe('USER');
    await fixture.prisma.user.update({
      where: { email: demoAccounts[1].email },
      data: {
        role: 'ADMIN',
        password: await bcrypt.hash('Changed-password-123', 10),
      },
    });
    await expect(seedDemoData(fixture.prisma)).rejects.toThrow(
      'refusing to replace',
    );
    expect(await fixture.prisma.user.count()).toBe(2);
  });
});
