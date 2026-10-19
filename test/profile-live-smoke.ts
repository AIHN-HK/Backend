/** Local-only smoke: real Prisma/PostgreSQL + JWT + HTTP + Expo browser. Removes its test users. */
import 'dotenv/config';
import assert = require('node:assert/strict');
import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { PrismaService } from '../src/core/database/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { ValidationPipe } from '../src/core/pipes/validation.pipe';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';

async function main() {
  const originalLog = console.log;
  // Existing auth decorators log headers; keep smoke output free of temporary JWTs.
  console.log = (...args: unknown[]) => {
    if (args[0] === 'AUTH HEADER:' || args[0] === 'JWT PAYLOAD:') return;
    originalLog(...args);
  };
  const config = new ConfigService();
  const url = new URL(config.getOrThrow<string>('DATABASE_URL'));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    throw new Error('Smoke only runs on local DB');
  const prisma = new PrismaClient();
  const ids: number[] = [];
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  let browser: any;
  async function createApp() {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        UsersRepository,
        JwtStrategy,
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const application = module.createNestApplication();
    application.setGlobalPrefix('api/v1');
    application.useGlobalGuards(new JwtAuthGuard(module.get(Reflector)));
    application.useGlobalPipes(new ValidationPipe());
    application.useGlobalInterceptors(
      new TransformInterceptor(module.get(Reflector)),
    );
    await application.listen(3107, '127.0.0.1');
    return application;
  }
  try {
    for (const name of ['Local An', 'Local Bình']) {
      const user = await prisma.user.create({
        data: {
          fullname: name,
          phone: '0901234567',
          email: `profile-smoke-${randomUUID()}@example.test`,
          password: randomUUID(),
          yob: new Date('2009-01-01'),
        },
      });
      ids.push(user.id);
    }
    app = await createApp();
    const jwt = new JwtService({
      secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    const tokens = ids.map((userId) =>
      jwt.sign({ userId }, { expiresIn: '5m' }),
    );
    // Optional browser tooling is supplied by the local smoke environment.
    const { chromium } = await import(
      process.env.PLAYWRIGHT_MODULE || 'playwright'
    );
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(
      (token: string) =>
        localStorage.setItem('access_token', JSON.stringify(token)),
      tokens[0],
    );
    const page = await context.newPage();
    // Forward the existing frontend base URL to this isolated real HTTP server.
    await page.route('**/api/v1/users/me', async (route: any) => {
      const response = await route.fetch({
        url: 'http://127.0.0.1:3107/api/v1/users/me',
      });
      await route.fulfill({ response });
    });
    await page.goto('http://localhost:8083/profile');
    await page.getByTestId('profile-fullname').waitFor({ timeout: 30000 });
    assert.equal(
      await page.getByTestId('profile-fullname').inputValue(),
      'Local An',
    );
    await page.getByTestId('profile-fullname').fill('Lưu thật vào PostgreSQL');
    await page.getByTestId('profile-class').fill('11');
    await page.getByTestId('profile-save').click();
    await page.getByText('Đã lưu hồ sơ.', { exact: true }).waitFor();
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: ids[0] },
    });
    assert.equal(stored.fullname, 'Lưu thật vào PostgreSQL');
    assert.equal(stored.class, 11);
    await page.reload();
    await page.getByTestId('profile-fullname').waitFor();
    assert.equal(
      await page.getByTestId('profile-fullname').inputValue(),
      'Lưu thật vào PostgreSQL',
    );
    await page.evaluate((token: string) => {
      localStorage.setItem('access_token', JSON.stringify(token));
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'access_token' }),
      );
    }, tokens[1]);
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            '[data-testid="profile-fullname"]',
          ) as HTMLInputElement
        )?.value === 'Local Bình',
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } })).fullname,
      'Local Bình',
    );
    const other = await fetch(`http://127.0.0.1:3107/api/v1/users/${ids[1]}`, {
      headers: { Authorization: `Bearer ${tokens[0]}` },
    });
    assert.equal(other.status, 403);
    const response = await fetch('http://127.0.0.1:3107/api/v1/users/me', {
      headers: { Authorization: `Bearer ${tokens[0]}` },
    });
    const body = await response.json();
    assert.ok(!('password' in body.data) && !('role' in body.data));
    console.log(
      'PASS live local PostgreSQL/JWT/HTTP/browser: GET, PATCH, DB persistence, browser reload, account switch, owner restriction, sensitive field exclusion',
    );
  } finally {
    if (browser) await browser.close();
    if (app) await app.close();
    if (ids.length)
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    console.log('Temporary smoke users removed; DB disconnected');
    console.log = originalLog;
  }
}
main().catch((error) => {
  console.error(error?.message || 'Smoke failed');
  process.exitCode = 1;
});
