/** Real React -> NestJS -> PostgreSQL/Redis/Bull; only provider text is a local protocol fixture. */
import 'dotenv/config';
import assert = require('node:assert/strict');
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import bcrypt = require('bcrypt');
import WebSocket = require('ws');
import { LocalBackendFixture } from './support/local-backend-fixture';
import { importCareerData } from '../scripts/import-career-data';
import { codes, Vector } from '../src/modules/career/domain/scoring';

async function freePort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}
async function main() {
  const frontend = resolve('../Frontend');
  const { chromium, expect } = require(
    join(frontend, 'node_modules/@playwright/test'),
  );
  const ai = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((r) => ai.once('listening', r));
  const wire: any[] = [];
  ai.on('connection', (c) =>
    c.once('message', (raw) => {
      wire.push(JSON.parse(raw.toString()));
      c.send(JSON.stringify({ type: 'start' }));
      c.send(
        JSON.stringify({
          type: 'token',
          content: 'Local integrated browser protocol fixture answer.',
        }),
      );
      c.send(JSON.stringify({ type: 'end' }));
    }),
  );
  const port = await freePort(),
    origin = `http://127.0.0.1:${port}`;
  const fixture = new LocalBackendFixture(undefined, {
    CORS_ORIGINS: origin,
    AI_WS_URL: `ws://127.0.0.1:${(ai.address() as { port: number }).port}`,
  });
  let preview: ChildProcess, browser: any;
  try {
    await fixture.start();
    await importCareerData(fixture.prisma);
    const owner = await fixture.prisma.user.create({
      data: {
        email: 'browser-career@example.test',
        fullname: 'Integrated browser fixture',
        password: await bcrypt.hash('Fixture-password-123', 10),
        yob: new Date('2009-11-30'),
      },
    });
    await fixture.prisma.priority.createMany({
      data: codes.map((type, i) => ({ type, priority: i + 1 })),
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
    await fixture.prisma.question.createMany({
      data: codes.flatMap((type) =>
        Array.from({ length: 18 }, (_, i) => ({
          content: `Browser fixture ${type} ${i}`,
          type,
          dimension: 'INTEREST' as const,
        })),
      ),
    });
    const questions = await fixture.prisma.question.findMany({
      orderBy: { id: 'asc' },
    });
    const snapshotQuestions = questions.map((q, i) => ({
      ...q,
      answerValue: Number(q.type === 'I' || i % 5 === 0),
    }));
    const scores = Object.fromEntries(
      codes.map((c) => [
        c,
        snapshotQuestions.filter((q) => q.type === c && q.answerValue === 1)
          .length,
      ]),
    ) as Vector;
    const topCode = codes
      .slice()
      .sort(
        (a, b) => scores[b] - scores[a] || codes.indexOf(a) - codes.indexOf(b),
      )
      .slice(0, 3)
      .join('');
    const attempt = await fixture.prisma.attempt.create({
      data: { userId: owner.id, totalQuestions: 108, finishAt: new Date() },
    });
    const result = {
      scoreR: scores.R,
      scoreI: scores.I,
      scoreA: scores.A,
      scoreS: scores.S,
      scoreE: scores.E,
      scoreC: scores.C,
      topCode,
    };
    await fixture.prisma.result.create({
      data: { attemptId: attempt.id, ...result },
    });
    await fixture.prisma.snapShot.create({
      data: {
        attemptId: attempt.id,
        snapshot: JSON.parse(
          JSON.stringify({ result, questions: snapshotQuestions }),
        ),
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
    assert.equal(built.status, 0, 'Isolated React production build failed');
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
      { cwd: frontend, stdio: ['ignore', 'pipe', 'pipe'] },
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
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(origin + '/login');
    await page
      .getByLabel('Email trường hoặc cá nhân')
      .fill('browser-career@example.test');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('Fixture-password-123');
    await page
      .getByRole('button', { name: 'Đăng nhập vào Trang của tôi →' })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(origin + '/careers/15-1252.00');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Software Developers',
    );
    await page
      .getByRole('link', { name: 'Chọn làm mục tiêu trong hồ sơ' })
      .click();
    await expect(page.getByLabel('Mã nghề mục tiêu')).toHaveValue('15-1252.00');
    await page.getByLabel('Mức Programming').selectOption('0');
    await page.getByRole('button', { name: 'Lưu hồ sơ định hướng' }).click();
    await expect
      .poll(
        async () =>
          (
            await fixture.prisma.careerProfile.findUnique({
              where: { userId: owner.id },
            })
          )?.revision,
      )
      .toBe(1);
    await page.goto(origin + '/recommendations');
    await page
      .getByRole('button', { name: 'Tạo gợi ý nghề', exact: true })
      .click();
    await expect(page.locator('.platform-grid article')).toHaveCount(20);
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
      .fill('Read sourced work activities and recorded my reflections.');
    await page
      .getByRole('button', { name: 'Xác nhận hoàn thành', exact: true })
      .first()
      .click();
    await expect
      .poll(() =>
        fixture.prisma.goalTask.count({
          where: { goal: { userId: owner.id }, done: true },
        }),
      )
      .toBe(1);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload();
      await expect(
        page.getByRole('progressbar', { name: 'Tiến độ Software Developers' }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Roadmap overflow at ${width}`,
      );
      await page.screenshot({
        path: join(fixture.directory, `career-roadmap-${width}.png`),
        fullPage: true,
      });
    }
    await page.goto(origin + '/dashboard');
    await expect(
      page.getByRole('region', { name: 'Phân tích hành trình hướng nghiệp' }),
    ).toContainText('1 bản gợi ý đã tạo');
    await page.goto(origin + '/advisor');
    await page
      .getByRole('button', { name: 'Kết nối hội thoại mới', exact: true })
      .click();
    await expect(page).toHaveURL(/sessionId=/);
    await page
      .getByRole('textbox', { name: 'Câu hỏi của bạn', exact: true })
      .fill('What should I practice for my target career?');
    await page.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(page.getByRole('log')).toContainText(
      'Local integrated browser protocol fixture answer.',
    );
    assert.equal(wire[0].profile_json.career_context.target.id, '15-1252.00');
    assert.equal(wire[0].profile_json.career_context.roadmaps[0].completed, 1);
    await page.reload();
    await expect(page.getByRole('log')).toContainText(
      'Local integrated browser protocol fixture answer.',
    );
    writeFileSync(
      join(fixture.directory, 'verification.json'),
      JSON.stringify(
        {
          mode: 'isolated-real-frontend-backend-db-redis-local-ai-protocol',
          careers: 923,
          skills: 35,
          assessment: '108-question binary fixture snapshot',
          recommendations: await fixture.prisma.recommendationRun.count(),
          goals: await fixture.prisma.careerGoal.count(),
          completedTasks: 1,
          responsive: [320, 390, 768, 1440],
          providerVerified: false,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS integrated React/NestJS/PostgreSQL/Redis/Bull browser career journey. Artifacts: ${fixture.directory}`,
    );
  } finally {
    await browser?.close();
    if (preview && preview.exitCode === null) {
      const exited = new Promise<void>((r) => preview.once('exit', () => r()));
      preview.kill('SIGTERM');
      await exited;
    }
    for (const c of ai.clients) c.terminate();
    await new Promise<void>((r) => ai.close(() => r()));
    await fixture.stop();
  }
}
main().catch(() => {
  console.error(
    'Integrated career browser smoke failed; inspect the owned fixture logs/artifacts.',
  );
  process.exitCode = 1;
});
