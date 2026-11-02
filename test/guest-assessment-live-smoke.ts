/** Isolated real API/DB/Redis/SMTP/browser acceptance, no external AI/mail. */
import 'dotenv/config';
import assert = require('node:assert/strict');
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { LocalBackendFixture } from './support/local-backend-fixture';

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
async function smtpCapture() {
  const codes: string[] = [];
  const server = createServer((socket) => {
    let buffer = '',
      receiving = false;
    socket.write('220 owned SMTP fixture\r\n');
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
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return { server, codes, port: (server.address() as { port: number }).port };
}

let stage = 'startup';
async function main() {
  const frontend = resolve('../Frontend');
  const { chromium, expect } = createRequire(join(frontend, 'package.json'))(
    '@playwright/test',
  );
  const smtp = await smtpCapture(),
    port = await freePort(),
    origin = `http://127.0.0.1:${port}`;
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
  let preview: ChildProcess | undefined, browser: any;
  const codes = ['R', 'I', 'A', 'S', 'E', 'C'];
  const api = async (
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ) => {
    const response = await fetch(fixture.origin + '/api/v1/' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await fixture.start();
    await fixture.prisma.priority.createMany({
      data: codes.map((type, index) => ({ type, priority: index + 1 })),
    });
    await fixture.prisma.question.createMany({
      data: codes.flatMap((type) =>
        Array.from({ length: 18 }, (_, index) => ({
          content: `Owned Holland ${type} activity ${index + 1}`,
          type,
          dimension: 'INTEREST' as const,
        })),
      ),
    });
    for (const code of codes)
      await fixture.prisma.topCode.create({
        data: {
          code,
          title: `Group ${code}`,
          description: `Owned ${code} analysis`,
          personality: [],
          strengths: [],
          weaknesses: [],
          careers: [],
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
      { cwd: frontend, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const log = createWriteStream(join(fixture.directory, 'preview.log'));
    preview.stdout!.pipe(log);
    preview.stderr!.pipe(log);
    for (let index = 0; index < 100; index++) {
      try {
        if ((await fetch(origin)).status === 200) break;
      } catch {
        /* preview startup */
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    stage = 'anonymous 108-question assessment';
    await page.goto(origin + '/assessment');
    const catalogResponse = page.waitForResponse((response) =>
      response.url().endsWith('/guest-assessment/catalog'),
    );
    await page
      .getByRole('button', { name: 'Bắt đầu bài trắc nghiệm', exact: true })
      .click();
    const catalog = (await (await catalogResponse).json()).data;
    assert.equal(catalog.questions.length, 108);
    for (let index = 0; index < 108; index++) {
      await page
        .getByRole('radio', {
          name: index % 3 ? 'Có — Tôi thích' : 'Không — Tôi không thích',
          exact: true,
        })
        .check();
      if (index < 107)
        await page
          .getByRole('button', { name: 'Tiếp theo', exact: true })
          .click();
    }
    await page
      .getByRole('button', { name: 'Xem tổng kết RIASEC', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: /^TopCode:/ }),
    ).toBeVisible();
    assert.equal(await fixture.prisma.attempt.count(), 0);
    assert.equal(await fixture.prisma.guestAssessmentClaim.count(), 0);
    const draft = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('aihn.assessment.guest.v1')!),
    );
    assert.equal(
      (
        await api('POST', 'guest-assessment/claim', {
          receipt: draft.result.receipt,
        })
      ).status,
      401,
    );
    const screenshotDirectory = resolve(
      frontend,
      '.superpowers/guest-assessment/G04',
    );
    mkdirSync(screenshotDirectory, { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        );
      });
      await page.screenshot({
        path: join(screenshotDirectory, `live-result-${width}.png`),
        fullPage: true,
      });
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        document: document.documentElement.scrollWidth,
        nodes: [...document.querySelectorAll('main *')]
          .filter((node) => node.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 8)
          .map((node) => ({
            tag: node.tagName,
            class: node.className,
            right: node.getBoundingClientRect().right,
            text: node.textContent?.slice(0, 90),
          })),
      }));
      assert.ok(overflow.document <= overflow.width, JSON.stringify(overflow));
    }
    stage = 'registration OTP login and automatic import';
    await page
      .getByRole('link', { name: 'Xây dựng lộ trình', exact: true })
      .click();
    await page.getByRole('link', { name: 'Đăng ký miễn phí' }).click();
    const email = `guest-${randomUUID()}@example.test`,
      password = 'Guest-fixture-password-123';
    await page
      .getByLabel('Họ và tên của bạn')
      .fill('Guest integration student');
    await page.getByLabel('Địa chỉ Email').fill(email);
    await page.getByLabel('Ngày sinh').fill('2008-01-01');
    await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567');
    await page.getByLabel('Tạo mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Tiếp tục xác thực OTP →' }).click();
    await expect(page).toHaveURL(/otp-verify\?returnTo=/);
    await expect.poll(() => smtp.codes.length, { timeout: 15000 }).toBe(1);
    await page
      .getByRole('textbox', { name: 'Chữ số 1', exact: true })
      .fill(smtp.codes[0]);
    await page
      .getByRole('button', { name: 'Xác nhận đăng ký', exact: true })
      .click();
    await expect(page).toHaveURL(/login\?returnTo=/);
    await page.getByLabel('Email trường hoặc cá nhân').fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page
      .getByRole('button', { name: 'Đăng nhập vào Trang của tôi →' })
      .click();
    await expect(page).toHaveURL(origin + '/roadmap');
    const user = await fixture.prisma.user.findUniqueOrThrow({
      where: { email },
    });
    const claim = await fixture.prisma.guestAssessmentClaim.findUniqueOrThrow({
      where: { id: draft.catalog.id },
    });
    assert.equal(claim.userId, user.id);
    const saved = await fixture.prisma.attempt.findUniqueOrThrow({
      where: { id: claim.attemptId },
      include: { result: true, answers: true, snapshots: true },
    });
    assert.equal(saved.totalQuestions, 108);
    assert.equal(saved.answers.length, 108);
    assert.equal(
      saved.answers.filter((answer) => answer.answerValue === 0).length,
      36,
    );
    assert.ok(saved.finishAt);
    assert.equal(saved.result!.topCode, draft.result.topCode);
    assert.deepEqual(saved.snapshots!.snapshot, {
      ...draft.result.snapshot,
      source: 'guest-assessment-v1',
      priorities: codes.map((type, index) => ({ type, priority: index + 1 })),
    });
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem('aihn.assessment.guest.v1'),
      ),
      null,
    );
    const token = await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('aihn.auth.v1')!).tokens.accessToken,
    );
    stage = 'repeat and concurrent durable imports';
    const repeats = await Promise.all([
      api(
        'POST',
        'guest-assessment/claim',
        { receipt: draft.result.receipt },
        token,
      ),
      api(
        'POST',
        'guest-assessment/claim',
        { receipt: draft.result.receipt },
        token,
      ),
    ]);
    for (const response of repeats) {
      assert.equal(response.status, 200);
      assert.equal(response.body.data.attemptId, claim.attemptId);
    }
    assert.equal(await fixture.prisma.attempt.count(), 1);
    const second = (await api('GET', 'guest-assessment/catalog')).body.data;
    const secondPreview = (
      await api('POST', 'guest-assessment/preview', {
        catalogToken: second.catalogToken,
        answers: second.questions.map((q) => ({
          questionId: q.id,
          check: true,
        })),
      })
    ).body.data;
    const parallel = await Promise.all([
      api(
        'POST',
        'guest-assessment/claim',
        { receipt: secondPreview.receipt },
        token,
      ),
      api(
        'POST',
        'guest-assessment/claim',
        { receipt: secondPreview.receipt },
        token,
      ),
    ]);
    for (const response of parallel) assert.equal(response.status, 200);
    assert.equal(
      parallel[0].body.data.attemptId,
      parallel[1].body.data.attemptId,
    );
    assert.equal(await fixture.prisma.attempt.count(), 2);
    stage = 'tamper, cross-owner isolation and catalog drift';
    const other = await fixture.prisma.user.create({
      data: {
        email: 'other-guest@example.test',
        fullname: 'Other user',
        password: 'fixture-not-a-login-hash',
        yob: new Date('2008-01-01'),
      },
    });
    const otherToken = new JwtService().sign(
      { userId: other.id },
      { secret: fixture.secret, expiresIn: 60 },
    );
    assert.equal(
      (
        await api(
          'POST',
          'guest-assessment/claim',
          { receipt: draft.result.receipt },
          otherToken,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          'GET',
          `guest-assessment/claim/${claim.id}`,
          undefined,
          otherToken,
        )
      ).status,
      404,
    );
    const [header, payload, signature] = draft.result.receipt.split('.');
    const edited = JSON.parse(Buffer.from(payload, 'base64url').toString());
    edited.answers[0].check = true;
    assert.equal(
      (
        await api(
          'POST',
          'guest-assessment/claim',
          {
            receipt: `${header}.${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${signature}`,
          },
          token,
        )
      ).status,
      400,
    );
    const third = (await api('GET', 'guest-assessment/catalog')).body.data;
    const thirdPreview = (
      await api('POST', 'guest-assessment/preview', {
        catalogToken: third.catalogToken,
        answers: third.questions.map((q) => ({
          questionId: q.id,
          check: true,
        })),
      })
    ).body.data;
    await fixture.prisma.question.update({
      where: { id: third.questions[0].id },
      data: { content: 'Changed only inside owned fixture' },
    });
    assert.equal(
      (
        await api(
          'POST',
          'guest-assessment/claim',
          { receipt: thirdPreview.receipt },
          token,
        )
      ).status,
      409,
    );
    assert.equal(await fixture.prisma.attempt.count(), 2);
    await page.goto(origin + `/assessment/results/${claim.attemptId}`);
    await expect(
      page.getByRole('heading', {
        name: `TopCode: ${draft.result.topCode}`,
        exact: true,
      }),
    ).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        status: 'passed',
        questions: 108,
        noAnswersPreserved: 36,
        anonymousDatabaseWrites: 0,
        signupOtpLoginImport: true,
        roadmapDestination: true,
        durableAttemptsAfterTwoDistinctImports: 2,
        sameOwnerIdempotent: true,
        concurrentImport: true,
        otherOwnerDenied: true,
        tamperDenied: true,
        changedBankDenied: true,
        screenshots: screenshotDirectory,
      }),
    );
  } finally {
    await browser?.close();
    if (preview && preview.exitCode === null) {
      preview.kill('SIGTERM');
      await new Promise<void>((done) => preview!.once('exit', () => done()));
    }
    await fixture.stop();
    await new Promise<void>((done) => smtp.server.close(() => done()));
  }
}
void main().catch((error) => {
  console.error(`Guest acceptance failed at ${stage}:`, error.message);
  process.exitCode = 1;
});
