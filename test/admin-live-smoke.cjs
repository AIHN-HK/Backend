// Read-only local smoke. Uses existing accounts; never seeds or mutates the DB.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const prisma = new PrismaClient();
const origin = process.env.ADMIN_API_ORIGIN || 'http://localhost:3000';
const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });
const secretKeys = new Set([
  'password',
  'refreshTokens',
  'accessToken',
  'refreshToken',
  'otp',
]);
function checkSafe(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!secretKeys.has(key), `private field ${key}`);
    checkSafe(child);
  }
}
(async () => {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const student = await prisma.user.findFirst({
      where: { role: 'USER' },
      select: { id: true },
    });
    assert.ok(admin, 'bootstrap an admin before running the local smoke');
    const token = jwt.sign({ userId: admin.id }, { expiresIn: '10m' });
    const get = async (path, expected = 200, bearer = token) => {
      const response = await fetch(`${origin}/api/v1/${path}`, {
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      });
      assert.equal(response.status, expected, `${path} HTTP status`);
      if (expected !== 200) return;
      const body = await response.json();
      checkSafe(body.data);
      return body.data;
    };
    const me = await get('admin/me');
    assert.equal(me.id, admin.id);
    await get('admin/overview', 401, null);
    if (student)
      await get(
        'admin/overview',
        403,
        jwt.sign({ userId: student.id, role: 'ADMIN' }),
      );
    const overview = await get('admin/overview');
    assert.equal(
      overview.counts.students,
      await prisma.user.count({ where: { role: 'USER' } }),
    );
    const questions = await get('admin/questions');
    assert.equal(questions.items.length, await prisma.question.count());
    assert.equal(
      questions.activeAttempts,
      await prisma.attempt.count({ where: { finishAt: null } }),
    );
    if (questions.activeAttempts)
      assert.ok(questions.items.every((q) => !q.editable));
    const content = await get('admin/topcodes');
    assert.equal(content.length, 6);
    assert.ok(
      content.every((c) =>
        ['personality', 'strengths', 'weaknesses', 'careers'].every((k) =>
          Array.isArray(c[k]),
        ),
      ),
    );
    const students = await get('admin/students?page=1&limit=20');
    assert.ok(students.items.length <= 20);
    if (student) {
      const detail = await get(`admin/students/${student.id}`);
      assert.equal(detail.student.id, student.id);
      assert.ok(detail.attempts.items.every((a) => a.finishAt && a.result));
    }
    await get('admin/students?limit=51', 400);
    const priorities = await get('priority');
    assert.equal(priorities.length, 6);
    console.log(
      'PASS local admin API: real JWT/ADMIN/USER/guest, DB counts, questions locks, seeded Holland shapes, safe student detail, pagination; zero writes',
    );
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
