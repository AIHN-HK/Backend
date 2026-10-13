import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminService } from '../src/modules/admin/admin.service';
import { AdminRepository } from '../src/modules/admin/admin.repository';
import { PrismaService } from '../src/core/database/prisma.service';
import { RedisService } from '../src/core/redis/redis.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { UsersRepository } from '../src/modules/users/users.repository';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { QuestionRepository } from '../src/modules/question/question.repository';
import { QuestionService } from '../src/modules/question/question.service';
import { SessionRepository } from '../src/modules/test-session/test-session.repository';
import { AnswerService } from '../src/modules/answer/answer.service';

describe('admin dashboard contract', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: 'admin-test' });
  let studentQuery: any;
  let writes: any[];
  const user = {
    id: 1,
    fullname: 'An',
    email: 'an@test.local',
    role: 'USER',
    class: 11,
    createdAt: new Date('2026-01-01'),
  };
  const prisma: any = {
    adminAuditLog: { create: async () => ({}) },
    user: {
      count: async () => 1,
      findMany: async (query: any) => {
        studentQuery = query;
        return [user];
      },
      findFirst: async ({ where }: any) => (where.id === 1 ? user : null),
    },
    question: { count: async () => 108, findMany: async () => [] },
    attempt: {
      count: async ({ where }: any) => (where.finishAt === null ? 0 : 1),
      findMany: async () => [
        {
          id: 7,
          finishAt: new Date(),
          result: { topCode: 'RIA' },
          user: { id: 1, fullname: 'An' },
        },
      ],
    },
    chatSession: { count: async () => 3 },
    topCode: { findMany: async () => [] },
    priority: {
      findMany: async () =>
        ['R', 'I', 'A', 'S', 'E', 'C'].map((type, i) => ({
          id: i + 1,
          type,
          priority: i + 1,
        })),
      update: async (q: any) => {
        writes.push(q);
        return { id: q.where.id, ...q.data };
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const token = (id = 2) => jwt.sign({ userId: id, role: 'ADMIN' });
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
        AdminRepository,
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'admin-test' } },
        {
          provide: UsersRepository,
          useValue: {
            findById: async (id: number) =>
              id === 2
                ? { id, fullname: 'Admin', role: 'ADMIN' }
                : id === 1
                  ? user
                  : null,
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { del: async () => undefined } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalGuards(
      new JwtAuthGuard(mod.get(Reflector)),
      new RolesGuard(mod.get(Reflector)),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    writes = [];
  });
  afterAll(async () => app?.close());
  it.each([
    '/admin/me',
    '/admin/overview',
    '/admin/students',
    '/admin/students/1',
    '/admin/questions',
    '/admin/topcodes',
  ])('blocks guest and forged ADMIN role at %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get(path)
      .auth(token(1), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(path)
      .auth(token(), { type: 'bearer' })
      .expect(200);
  });
  it('reports real counts and recent completed tests', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/admin/overview')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(body.counts).toEqual({
      students: 1,
      completedTests: 1,
      chatSessions: 3,
      questions: 108,
    });
    expect(body.recentAttempts[0].id).toBe(7);
  });
  it('paginates and limits searches to students with an explicit safe projection', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/admin/students?q=An&page=2&limit=10')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(body.page).toBe(2);
    expect(body.total).toBe(1);
    expect(studentQuery.where.role).toBe('USER');
    expect(studentQuery.skip).toBe(10);
    expect(studentQuery.where.OR[0].fullname).toEqual({
      contains: 'An',
      mode: 'insensitive',
    });
    expect(studentQuery.select.password).toBeUndefined();
    expect(studentQuery.select.refreshTokens).toBeUndefined();
  });
  it.each(['limit=51', 'limit=0', 'page=-1', 'page=1.5'])(
    'rejects invalid pagination %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/admin/students?${query}`)
        .auth(token(), { type: 'bearer' })
        .expect(400);
    },
  );
  it('does not return detail for a missing student', async () => {
    await request(app.getHttpServer())
      .get('/admin/students/99')
      .auth(token(), { type: 'bearer' })
      .expect(404);
  });
  it('reorders six priorities atomically and rejects duplicate groups without writes', async () => {
    const priorities = ['C', 'E', 'S', 'A', 'I', 'R'].map((type, i) => ({
      type,
      priority: i + 1,
    }));
    await request(app.getHttpServer())
      .put('/admin/priorities')
      .auth(token(1), { type: 'bearer' })
      .send({ priorities })
      .expect(403);
    expect(writes).toHaveLength(0);
    await request(app.getHttpServer())
      .put('/admin/priorities')
      .auth(token(), { type: 'bearer' })
      .send({ priorities })
      .expect(200);
    expect(writes.find((q) => q.where.id === 6).data.priority).toBe(1);
    writes = [];
    priorities[0].type = 'R';
    await request(app.getHttpServer())
      .put('/admin/priorities')
      .auth(token(), { type: 'bearer' })
      .send({ priorities })
      .expect(400);
    expect(writes).toHaveLength(0);
  });
});

describe('new grading after priority changes', () => {
  it('uses authoritative priority ordering even when an old cache fill is still present', async () => {
    const current = ['I', 'R', 'A', 'S', 'E', 'C'].map((type, i) => ({
      type,
      priority: i + 1,
    }));
    const service = new AnswerService(
      null,
      null,
      null,
      null,
      { getPriorities: async () => current } as any,
      null,
    );
    expect(
      await service.findTopCode({ R: 5, I: 5, A: 4, S: 3, E: 2, C: 1 }, 3),
    ).toBe('IRA');
  });
});

describe('question bank integrity', () => {
  it('serves the current question bank even if a pre-edit cache fill exists', async () => {
    const old = {
      I: {
        'TÔI THÍCH': [
          { id: 1, content: 'Old', type: 'I', dimension: 'INTEREST' },
        ],
      },
    };
    const current = {
      I: {
        'TÔI THÍCH': [
          { id: 1, content: 'Old', type: 'I', dimension: 'INTEREST' },
          { id: 2, content: 'New', type: 'I', dimension: 'INTEREST' },
        ],
      },
    };
    const service = new QuestionService(
      { getALL: async () => current } as any,
      { getOrSet: async () => old } as any,
    );
    expect((await service.getAllQuestion()).I['TÔI THÍCH']).toHaveLength(2);
  });
  let used = 0,
    unfinished = 0,
    writes = 0;
  const db: any = {
    attempt: { count: async () => unfinished },
    answer: { count: async () => used },
    question: {
      findUnique: async () => ({ id: 1 }),
      create: async () => {
        writes++;
      },
      update: async () => {
        writes++;
      },
      delete: async () => {
        writes++;
      },
    },
    $transaction: async (fn: any) => fn(db),
  };
  const repo = new QuestionRepository(db);
  beforeEach(() => {
    used = 0;
    unfinished = 0;
    writes = 0;
  });
  it('rejects changes to a question with historical answers', async () => {
    used = 1;
    await expect(repo.update(1, { content: 'New' })).rejects.toMatchObject({
      status: 409,
    });
    await expect(repo.remove(1)).rejects.toMatchObject({ status: 409 });
    expect(writes).toBe(0);
  });
  it('rejects adding or changing questions while any attempt is unfinished', async () => {
    unfinished = 1;
    await expect(
      repo.create({ content: 'New', type: 'R' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(repo.update(1, { content: 'New' })).rejects.toMatchObject({
      status: 409,
    });
    expect(writes).toBe(0);
  });
  it('allows editing unused questions outside active attempts', async () => {
    await repo.update(1, { content: 'New' });
    expect(writes).toBe(1);
  });
});

describe('attempt creation uses the same serializable boundary as bank changes', () => {
  it('counts current questions and creates the attempt in one transaction', async () => {
    const tx: any = {
      question: { count: async () => 15 },
      attempt: { create: async ({ data }: any) => ({ id: 7, ...data }) },
    };
    const db: any = {
      ...tx,
      $transaction: async (fn: any, options: any) => {
        expect(options.isolationLevel).toBe('Serializable');
        return fn(tx);
      },
    };
    const repo = new SessionRepository(db);
    expect(await (repo as any).create(1)).toEqual({
      id: 7,
      totalQuestions: 15,
      userId: 1,
    });
  });
});
