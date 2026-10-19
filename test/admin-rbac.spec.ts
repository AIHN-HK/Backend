import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { UsersRepository } from '../src/modules/users/users.repository';
import { QuestionController } from '../src/modules/question/question.controller';
import { QuestionService } from '../src/modules/question/question.service';
import { PriorityController } from '../src/modules/priority/priority.controller';
import { PriorityService } from '../src/modules/priority/priority.service';
import { TopcodeController } from '../src/modules/topcode/topcode.controller';
import { TopcodeService } from '../src/modules/topcode/topcode.service';
import { TestSessionController } from '../src/modules/test-session/test-session.controller';
import { TestSessionService } from '../src/modules/test-session/test-session.service';

describe('real JWT and RBAC on existing routes', () => {
  let app: INestApplication;
  let writes = 0;
  const jwt = new JwtService({ secret: 'w02-test-only' });
  const users = new Map([
    [1, { id: 1, role: 'USER' }],
    [2, { id: 2, role: 'ADMIN' }],
  ]);
  const write = async () => {
    writes++;
    return { ok: true };
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [
        QuestionController,
        PriorityController,
        TopcodeController,
        TestSessionController,
      ],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'w02-test-only' } },
        {
          provide: UsersRepository,
          useValue: { findById: async (id: number) => users.get(id) },
        },
        {
          provide: QuestionService,
          useValue: {
            createQuestion: write,
            updateQuestion: write,
            deleteQuestion: write,
            createMany: write,
            getAllQuestion: async () => [],
          },
        },
        {
          provide: PriorityService,
          useValue: { updatePriorities: write, getPriorities: async () => [] },
        },
        { provide: TopcodeService, useValue: { updateTopcode: write } },
        { provide: TestSessionService, useValue: { deleteSession: write } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalGuards(
      new JwtAuthGuard(mod.get(Reflector)),
      new RolesGuard(mod.get(Reflector)),
    );
    await app.init();
  });
  afterAll(async () => app?.close());
  const routes = [
    ['post', '/question'],
    ['patch', '/question/1'],
    ['delete', '/question/1'],
    ['post', '/question/bulk'],
    ['put', '/priority'],
    ['put', '/topcode'],
    ['delete', '/test-session/1'],
  ] as const;
  it.each(routes)(
    '%s %s rejects guests and regular users, allows ADMIN exactly once',
    async (method, path) => {
      const before = writes;
      await request(app.getHttpServer())
        [method](path)
        .send({ questions: [] })
        .expect(401);
      await request(app.getHttpServer())
        [method](path)
        .auth(jwt.sign({ userId: 1, role: 'ADMIN' }), { type: 'bearer' })
        .send({ questions: [] })
        .expect(403);
      expect(writes).toBe(before);
      await request(app.getHttpServer())
        [method](path)
        .auth(jwt.sign({ userId: 2 }), { type: 'bearer' })
        .send({ questions: [] })
        .expect(method === 'post' ? 201 : 200);
      expect(writes).toBe(before + 1);
    },
  );
  it('keeps public reads and denies a deleted user', async () => {
    await request(app.getHttpServer()).get('/question').expect(200);
    await request(app.getHttpServer()).get('/priority').expect(200);
    await request(app.getHttpServer())
      .put('/priority')
      .auth(jwt.sign({ userId: 999 }), { type: 'bearer' })
      .expect(401);
  });
  it('does not crash when role guard has no authenticated user', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => ['ADMIN'] } as any);
    expect(
      guard.canActivate({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as any),
    ).toBe(false);
  });
});
