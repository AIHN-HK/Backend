/** Real web/API/DB/Redis/SMTP regression; no external mail or provider calls. */
import 'dotenv/config';
import assert = require('node:assert/strict');
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import bcrypt = require('bcrypt');
import { LocalBackendFixture } from './support/local-backend-fixture';
import { importCareerData } from '../scripts/import-career-data';
import { codes } from '../src/modules/career/domain/scoring';

async function availablePort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}

async function smtpCapture() {
  const codes: string[] = [];
  const server = createServer((socket) => {
    let buffer = '',
      receiving = false;
    socket.write('220 owned fixture SMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (true) {
        if (receiving) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          const body = buffer
            .slice(0, end)
            .split('\r\n\r\n')
            .slice(1)
            .join('\r\n\r\n')
            .replace(/=\r\n/g, '');
          const code = body.match(/\b(\d{6})\b/)?.[1];
          if (code) codes.push(code);
          buffer = buffer.slice(end + 5);
          receiving = false;
          socket.write('250 queued\r\n');
        }
        const end = buffer.indexOf('\r\n');
        if (end < 0) return;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (/^EHLO|^HELO/.test(line)) socket.write('250 fixture\r\n');
        else if (line === 'DATA') {
          receiving = true;
          socket.write('354 end with dot\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
          return;
        } else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, codes, port: (server.address() as { port: number }).port };
}

let stage = 'startup';
async function main() {
  const frontend = resolve('../Frontend');
  const { chromium, expect } = createRequire(join(frontend, 'package.json'))(
    '@playwright/test',
  );
  const smtp = await smtpCapture(),
    port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const fixture = new LocalBackendFixture(undefined, {
    NODE_ENV: 'development',
    CORS_ORIGINS: origin,
    AI_WS_URL: '',
    MAIL_HOST: '127.0.0.1',
    MAIL_PORT: String(smtp.port),
    MAIL_USER: '',
    MAIL_PASS: '',
    MAIL_FROM: 'no-reply@example.test',
    SENDGRID_API_KEY: '',
  });
  let preview: ChildProcess, browser: any, page: any;
  const errors: string[] = [],
    serverErrors: string[] = [],
    screens: unknown[] = [];
  try {
    await fixture.start();
    await importCareerData(fixture.prisma);
    await fixture.prisma.priority.createMany({
      data: codes.map((type, i) => ({ type, priority: i + 1 })),
    });
    await fixture.prisma.question.createMany({
      data: codes.flatMap((type) =>
        Array.from({ length: 18 }, (_, i) => ({
          content: `Owned browser question ${type} ${i}`,
          type,
          dimension: 'INTEREST' as const,
        })),
      ),
    });
    for (const code of codes)
      await fixture.prisma.topCode.create({
        data: {
          code,
          title: `Owned fixture ${code}`,
          personality: [],
          strengths: [],
          weaknesses: [],
          careers: [],
        },
      });
    const adminPassword = 'Admin-fixture-password-123';
    await fixture.prisma.user.create({
      data: {
        email: 'admin-web@example.test',
        fullname: 'Web regression admin',
        role: 'ADMIN',
        password: await bcrypt.hash(adminPassword, 10),
        yob: new Date('1995-01-01'),
      },
    });
    const output = join(fixture.directory, 'web-dist');
    const built = spawnSync(
      'pnpm',
      ['exec', 'vite', 'build', '--outDir', output],
      {
        cwd: frontend,
        env: {
          ...process.env,
          VITE_API_ORIGIN: fixture.origin,
          VITE_SOCKET_ORIGIN: fixture.origin,
        },
        encoding: 'utf8',
        timeout: 90000,
      },
    );
    assert.equal(built.status, 0, 'Isolated frontend build failed');
    const log = createWriteStream(join(fixture.directory, 'preview.log'));
    preview = spawn(
      'pnpm',
      [
        'exec',
        'vite',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--outDir',
        output,
      ],
      {
        cwd: frontend,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    preview.stdout.pipe(log);
    preview.stderr.pipe(log);
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin)).status === 200) break;
      } catch {
        /* Starting preview. */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', () => errors.push(stage));
    page.on('response', (response: any) => {
      if (response.status() >= 500 && response.url().startsWith(fixture.origin))
        serverErrors.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        );
    });
    async function inspect(route: string, width: number, screenshot = false) {
      stage = `${route} at ${width}px`;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + route);
      await expect(
        page.getByRole('heading', { level: 1 }).first(),
      ).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.async-state-error')).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      const metrics = await page.evaluate(async () => {
        await document.fonts.ready;
        const visible = (node: Element) =>
          node.getClientRects().length > 0 &&
          getComputedStyle(node).visibility !== 'hidden';
        const controls = [
          ...document.querySelectorAll(
            'main input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), main select, main textarea',
          ),
        ].filter(visible);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          body: parseFloat(getComputedStyle(document.body).fontSize),
          controls: controls.map((node) =>
            parseFloat(getComputedStyle(node).fontSize),
          ),
        };
      });
      assert.equal(metrics.overflow, false, `Horizontal overflow: ${stage}`);
      assert.ok(metrics.body >= 16, `Body text too small: ${stage}`);
      assert.ok(
        metrics.controls.every((size: number) => size >= 16),
        `Form text too small: ${stage}`,
      );
      screens.push({ route, width, ...metrics });
      if (screens.length % 16 === 0)
        console.log(
          `Screen audit: ${screens.length} viewport checks completed`,
        );
      if (screenshot)
        await page.screenshot({
          path: join(
            fixture.directory,
            route.replaceAll('/', '_').replaceAll('?', '_') + `-${width}.png`,
          ),
          fullPage: true,
        });
    }
    for (const route of [
      '/',
      '/login',
      '/signup',
      '/forgot-password',
      '/verify-otp',
      '/reset-password',
      '/careers',
      '/careers/15-1252.00',
    ]) {
      for (const width of [320, 390, 768, 1440])
        await inspect(route, width, width === 390);
    }

    stage = 'registration-send-and-verify';
    const email = 'student-web@example.test',
      password = 'Student-fixture-password-123',
      nextPassword = 'Changed-fixture-password-123';
    await page.goto(origin + '/signup');
    await page.getByLabel('Họ và tên của bạn').fill('Web regression student');
    await page.getByLabel('Địa chỉ Email').fill(email);
    await page.getByLabel('Ngày sinh').fill('2008-01-01');
    await page.getByLabel('Số điện thoại').fill('0901234567');
    await page.getByLabel('Tạo mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Tiếp tục xác thực OTP →' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);
    assert.equal(
      smtp.codes.length,
      1,
      'Registration OTP did not reach owned SMTP',
    );
    await page
      .getByRole('textbox', { name: /^Chữ số/ })
      .first()
      .fill(smtp.codes[0]);
    await page
      .getByRole('button', { name: 'Xác nhận đăng ký', exact: true })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    const student = await fixture.prisma.user.findUniqueOrThrow({
      where: { email },
    });

    stage = 'recovery-send-verify-reset';
    await page.goto(origin + '/forgot-password');
    await page.getByLabel('Email tài khoản', { exact: true }).fill(email);
    await page.getByRole('button', { name: /Gửi mã OTP/ }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);
    assert.equal(smtp.codes.length, 2, 'Recovery OTP did not reach owned SMTP');
    await page
      .getByRole('textbox', { name: /^Chữ số/ })
      .first()
      .fill(smtp.codes[1]);
    await page
      .getByRole('button', { name: 'Xác nhận mã', exact: true })
      .click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill(nextPassword);
    await page
      .getByLabel('Xác nhận mật khẩu mới', { exact: true })
      .fill(nextPassword);
    await page
      .getByRole('button', { name: 'Đặt lại mật khẩu', exact: true })
      .click();
    await expect(page).toHaveURL(/\/login$/);

    async function login(address: string, secret: string, destination: RegExp) {
      await page.goto(origin + '/login');
      await page.getByLabel('Email trường hoặc cá nhân').fill(address);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(secret);
      await page
        .getByRole('button', { name: 'Đăng nhập vào Trang của tôi →' })
        .click();
      await expect(page).toHaveURL(destination);
    }
    stage = 'login-with-new-password';
    await login(email, nextPassword, /\/dashboard$/);
    for (const route of [
      '/dashboard',
      '/career-profile',
      '/history',
      '/recommendations',
      '/roadmap',
      '/settings',
      '/assessment',
      '/assessment/results',
      '/advisor',
    ]) {
      for (const width of [320, 390, 768, 1440]) await inspect(route, width);
    }
    stage = 'assessment-full-108';
    await page.goto(origin + '/assessment');
    await page
      .getByRole('button', { name: 'Bắt đầu bài trắc nghiệm', exact: true })
      .click();
    const questions = await fixture.prisma.question.findMany({
      orderBy: { id: 'asc' },
    });
    for (let i = 0; i < questions.length; i++) {
      await page
        .getByRole('radio', {
          name:
            questions[i].type === 'I' || i % 5 === 0
              ? 'Có — Tôi thích'
              : 'Không — Tôi không thích',
          exact: true,
        })
        .check();
      await page
        .getByRole('button', {
          name: i < questions.length - 1 ? 'Tiếp theo' : 'Nộp bài',
          exact: true,
        })
        .click();
    }
    await expect(page).toHaveURL(/\/assessment\/results\/\d+$/);
    const attempt = await fixture.prisma.attempt.findFirstOrThrow({
      where: { userId: student.id, finishAt: { not: null } },
    });
    stage = 'profile-save';
    await page.goto(origin + '/careers/15-1252.00');
    await page
      .getByRole('link', { name: 'Chọn làm mục tiêu trong hồ sơ' })
      .click();
    await expect(page.getByLabel('Mã nghề mục tiêu')).toHaveValue('15-1252.00');
    await page.getByLabel('Mức Programming').selectOption('0');
    await page
      .getByRole('button', { name: 'Lưu hồ sơ định hướng', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await fixture.prisma.careerProfile.findUnique({
              where: { userId: student.id },
            })
          )?.revision,
      )
      .toBe(1);
    stage = 'recommendation-create';
    await page.goto(origin + '/recommendations');
    await page
      .getByRole('button', { name: 'Tạo gợi ý nghề', exact: true })
      .click();
    await expect(page.locator('.platform-grid article')).toHaveCount(20);
    const run = await fixture.prisma.recommendationRun.findFirstOrThrow({
      where: { userId: student.id },
    });
    stage = 'roadmap-create';
    await page.goto(origin + '/roadmap');
    await page
      .getByRole('button', { name: 'Tạo lộ trình từ mục tiêu', exact: true })
      .click();
    await expect(
      page.getByRole('progressbar', { name: 'Tiến độ Software Developers' }),
    ).toBeVisible();
    await page
      .locator('.career-platform textarea')
      .first()
      .fill('Reviewed sourced career information and recorded evidence.');
    await page
      .getByRole('button', { name: 'Xác nhận hoàn thành', exact: true })
      .first()
      .click();
    await expect
      .poll(() =>
        fixture.prisma.goalTask.count({
          where: { goal: { userId: student.id }, done: true },
        }),
      )
      .toBe(1);
    for (const route of [
      `/assessment/results/${attempt.id}`,
      '/history',
      '/dashboard',
      '/career-profile',
      '/recommendations',
      `/recommendations/${run.id}`,
      '/roadmap',
    ]) {
      for (const width of [320, 390, 768, 1440])
        await inspect(
          route,
          width,
          ['/dashboard', '/recommendations', '/roadmap'].includes(route) &&
            width === 390,
        );
    }
    stage = 'student-logout';
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    stage = 'admin-login';
    await login('admin-web@example.test', adminPassword, /\/admin$/);
    for (const route of [
      '/admin',
      '/admin/questions',
      '/admin/scoring',
      '/admin/holland-content',
      '/admin/careers',
      '/admin/students',
      `/admin/students/${student.id}`,
    ]) {
      for (const width of [320, 390, 768, 1440])
        await inspect(route, width, width === 390);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.deepEqual(serverErrors, [], 'API server errors during screen audit');
    writeFileSync(
      join(fixture.directory, 'web-screen-audit.json'),
      JSON.stringify(
        {
          mode: 'real-react-api-postgresql-redis-local-smtp',
          otpMessages: smtp.codes.length,
          assessmentQuestions: questions.length,
          screens,
          externalEmailSent: false,
          externalProviderCalled: false,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS real signup/SMTP OTP/recovery/reset/login/108-question assessment/user/admin screens (${screens.length} viewport checks). Artifacts: ${fixture.directory}`,
    );
  } catch (error) {
    if (page)
      await page
        .screenshot({
          path: join(fixture.directory, 'failure.png'),
          fullPage: true,
        })
        .catch(() => {});
    console.error(
      `Web browser regression failed at ${stage}. Artifacts: ${fixture.directory}`,
    );
    throw error;
  } finally {
    await browser?.close();
    if (preview && preview.exitCode === null) {
      const exited = new Promise<void>((r) => preview.once('exit', () => r()));
      preview.kill('SIGTERM');
      await exited;
    }
    await fixture.stop();
    await new Promise<void>((r) => smtp.server.close(() => r()));
  }
}

main().catch(() => {
  process.exitCode = 1;
});
