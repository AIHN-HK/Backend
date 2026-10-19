/** Local-only real Prisma/PostgreSQL/Redis/JWT/HTTP smoke. Mail is captured, never sent. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert = require('node:assert/strict');
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthRepository } from '../src/modules/auth/auth.repository';
import { UsersRepository } from '../src/modules/users/users.repository';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { OtpService } from '../src/modules/otp/otp.service';
import { OtpRepository } from '../src/modules/otp/otp.repository';
import { PrismaService } from '../src/core/database/prisma.service';
import { RedisService } from '../src/core/redis/redis.service';
import { MailService } from '../src/core/services/mail_service';
import { HashingService } from '../src/core/services/hash.service';
import { TokenService } from '../src/core/services/token.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { RefreshStrategy } from '../src/modules/auth/strategies/refresh.strategy';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { OtpThrottlerGuard } from '../src/core/guards/otp-throttler.guard';
import { LoginConcurrencyGuard } from '../src/core/guards/login-concurrency.guard';
import { ValidationPipe } from '../src/core/pipes/validation.pipe';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { PriorityController } from '../src/modules/priority/priority.controller';
import { PriorityService } from '../src/modules/priority/priority.service';
import { bootstrapAdmin } from '../scripts/bootstrap-admin';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    throw Error('Smoke requires local PostgreSQL');
  if (
    !['localhost', '127.0.0.1', '::1'].includes(
      process.env.REDIS_HOST || 'localhost',
    )
  )
    throw Error('Smoke requires local Redis');
  const prisma = new PrismaClient();
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
  });
  const emails = [
    `w02-${randomUUID()}@example.test`,
    `w02-admin-${randomUUID()}@example.test`,
  ];
  const sent = new Map<string, string>();
  const ids: number[] = [];
  let app: any;
  let priorityWrites = 0;
  try {
    await redis.ping();
    const mod = await Test.createTestingModule({
      controllers: [AuthController, UsersController, PriorityController],
      providers: [
        AuthService,
        AuthRepository,
        UsersRepository,
        UsersService,
        OtpService,
        OtpRepository,
        HashingService,
        TokenService,
        JwtStrategy,
        RefreshStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: new ConfigService() },
        { provide: JwtService, useValue: new JwtService() },
        { provide: RedisService, useValue: new RedisService(redis) },
        {
          provide: MailService,
          useValue: {
            sendOtp: async (email: string, otp: string) => {
              sent.set(email, otp);
            },
          },
        },
        {
          provide: PriorityService,
          useValue: {
            getPriorities: async () => [],
            updatePriorities: async () => {
              priorityWrites++;
              return {};
            },
          },
        },
      ],
    })
      .overrideGuard(OtpThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LoginConcurrencyGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalGuards(
      new JwtAuthGuard(mod.get(Reflector)),
      new RolesGuard(mod.get(Reflector)),
    );
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor(mod.get(Reflector)));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function call(
      path: string,
      body?: unknown,
      token?: string,
      method = 'POST',
    ) {
      const response = await fetch(`${base}/api/v1${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    }
    const password = 'local-smoke-password';
    assert.equal(
      (await call('/auth/register/send-otp', { email: emails[0] })).status,
      201,
    );
    assert.equal(
      (await call('/auth/register/resend-otp', { email: emails[0] })).status,
      429,
    );
    const otp = sent.get(emails[0])!;
    const input = {
      email: emails[0],
      password,
      fullname: 'Local An',
      yob: '2009-01-01',
      phone: '0901234567',
      otpCode: otp,
    };
    assert.equal(
      (await call('/auth/register', { ...input, otpCode: '000000' })).status,
      401,
    );
    assert.equal(
      (await call('/auth/register', { ...input, role: 'ADMIN' })).status,
      400,
    );
    const registered = await call('/auth/register', input);
    assert.equal(registered.status, 201);
    assert.ok(!JSON.stringify(registered.body).includes(password));
    ids.push(registered.body.data.user.id);
    assert.equal(
      (
        await prisma.otp.findFirstOrThrow({
          where: { email: emails[0], type: 'REGISTER' },
        })
      ).used,
      true,
    );
    const login = await call('/auth/login', { email: emails[0], password });
    assert.equal(login.status, 201);
    let access = login.body.data.accessToken;
    let refresh = login.body.data.refreshToken;
    assert.equal((await call('/priority', {}, undefined, 'PUT')).status, 401);
    assert.equal((await call('/priority', {}, access, 'PUT')).status, 403);
    const rotating = await Promise.all([
      call('/auth/refresh', undefined, refresh),
      call('/auth/refresh', undefined, refresh),
    ]);
    assert.deepEqual(rotating.map((x) => x.status).sort(), [200, 401]);
    const success = rotating.find((x) => x.status === 200)!;
    access = success.body.data.accessToken;
    refresh = success.body.data.refreshToken;
    assert.equal(
      (await call('/auth/refresh', undefined, login.body.data.refreshToken))
        .status,
      401,
    );
    await redis.set(`user-context-${ids[0]}`, 'STALE');
    assert.equal(
      (
        await call(
          '/users/me',
          { fullname: 'Updated An', phone: '0901234567' },
          access,
          'PATCH',
        )
      ).status,
      200,
    );
    assert.equal(await redis.get(`user-context-${ids[0]}`), null);
    const forgot = await call('/auth/forgot-password/send-otp', {
      email: emails[0],
    });
    assert.equal(forgot.status, 201);
    assert.deepEqual(forgot.body.data, { sent: true });
    const resetOtp = sent.get(emails[0])!;
    assert.equal(
      (
        await call('/auth/verify-forget-password-otp', {
          email: emails[0],
          otp: resetOtp,
        })
      ).status,
      201,
    );
    const reset = {
      email: emails[0],
      otp: resetOtp,
      newPassword: 'new-local-password',
    };
    const resets = await Promise.all([
      call('/auth/reset-password', reset),
      call('/auth/reset-password', reset),
    ]);
    assert.deepEqual(resets.map((x) => x.status).sort(), [201, 401]);
    assert.equal(
      await prisma.refreshToken.count({ where: { userId: ids[0] } }),
      0,
    );
    assert.equal((await call('/auth/refresh', undefined, refresh)).status, 401);
    assert.equal(
      (await call('/auth/login', { email: emails[0], password })).status,
      401,
    );
    assert.equal(
      (
        await call('/auth/login', {
          email: emails[0],
          password: reset.newPassword,
        })
      ).status,
      201,
    );
    // Existing access token survives until its TTL, exactly as the approved plan specifies.
    assert.equal(
      (await call('/users/me', undefined, access, 'GET')).status,
      200,
    );
    await bootstrapAdmin(prisma, {
      BOOTSTRAP_ADMIN_EMAIL: emails[1],
      BOOTSTRAP_ADMIN_PASSWORD: password,
      BOOTSTRAP_ADMIN_FULLNAME: 'Local Admin',
      BOOTSTRAP_ADMIN_YOB: '1990-01-01',
    });
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: emails[1] },
    });
    ids.push(admin.id);
    assert.deepEqual(
      await bootstrapAdmin(prisma, {
        BOOTSTRAP_ADMIN_EMAIL: emails[1],
        BOOTSTRAP_ADMIN_PASSWORD: 'other-local-password',
        BOOTSTRAP_ADMIN_FULLNAME: 'Other',
        BOOTSTRAP_ADMIN_YOB: '1990-01-01',
      }),
      { created: false, id: admin.id },
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: admin.id } }))
        .password,
      admin.password,
    );
    await assert.rejects(
      bootstrapAdmin(prisma, {
        BOOTSTRAP_ADMIN_EMAIL: emails[0],
        BOOTSTRAP_ADMIN_PASSWORD: password,
        BOOTSTRAP_ADMIN_FULLNAME: 'Reject',
        BOOTSTRAP_ADMIN_YOB: '1990-01-01',
      }),
    );
    const adminLogin = await call('/auth/login', {
      email: emails[1],
      password,
    });
    assert.equal(adminLogin.status, 201);
    assert.equal(
      (
        await call(
          '/priority',
          { id: 1, priority: 1 },
          adminLogin.body.data.accessToken,
          'PUT',
        )
      ).status,
      200,
    );
    assert.equal(priorityWrites, 1);
    assert.equal(
      (
        await call(
          `/users/${ids[0]}`,
          undefined,
          adminLogin.body.data.accessToken,
          'GET',
        )
      ).status,
      403,
    );
    assert.equal(
      (await call('/auth/logout', undefined, adminLogin.body.data.accessToken))
        .status,
      204,
    );
    assert.equal(
      (
        await call(
          '/auth/refresh',
          undefined,
          adminLogin.body.data.refreshToken,
        )
      ).status,
      401,
    );
    console.log(
      'PASS local PostgreSQL/Redis/JWT/HTTP: register, OTP cooldown/single use, password reset/revoke, concurrent refresh rotation, DB role RBAC, profile cache invalidation, logout, bootstrap idempotence/non-promotion. Mail captured; no external email.',
    );
  } finally {
    await app?.close();
    const owned = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ownedIds = owned.map((u) => u.id);
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: ownedIds } },
    });
    await prisma.otp.deleteMany({ where: { email: { in: emails } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    for (const id of ownedIds)
      await redis.del(`user-context-${id}`, `user:${id}`);
    await redis.quit();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error('Auth smoke failed', {
    name: error.name,
    code: error.code,
    line: error.stack
      ?.split('\n')
      .find((line: string) => line.includes('auth-live-smoke.ts')),
    actual: typeof error.actual === 'number' ? error.actual : undefined,
    expected: typeof error.expected === 'number' ? error.expected : undefined,
  });
  process.exitCode = 1;
});
