import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RIASEC_KEYS, ScoreCalculatorService } from '../src/modules/assessment';
import type { RiasecCode, RiasecScore } from '../src/modules/assessment';
import { careerInclude } from '../src/modules/career/career.repository';
import {
  profileData,
  scoringCareer,
} from '../src/modules/career/career.service';
import {
  algorithmVersion,
  normalizeSnapshot,
  rankCareers,
  skillGaps,
} from '../src/modules/career/domain/scoring';
import { planRoadmap } from '../src/modules/career/domain/roadmap';

export const demoAccounts = [
  {
    email: 'student.demo@aihn.test',
    fullname: '[DEMO] Học sinh AIHN',
    role: 'USER',
  },
  {
    email: 'admin.demo@aihn.test',
    fullname: '[DEMO] Quản trị AIHN',
    role: 'ADMIN',
  },
] as const;
export const defaultDemoPassword = 'AihnDemo!2026';

export function assertDemoEnvironment(environment = process.env.NODE_ENV) {
  if (environment === 'production')
    throw new Error(
      'Demo seed is disabled in production. Use seed:dev for reference data only.',
    );
}
export function demoPassword(value?: string) {
  const password =
    value === undefined || value === '' ? defaultDemoPassword : value;
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error(
      'SEED_DEMO_PASSWORD must have 12+ characters and at most 72 UTF-8 bytes.',
    );
  return password;
}

export async function seedDemoData(
  db: PrismaClient,
  options: { environment?: string; password?: string } = {},
) {
  assertDemoEnvironment(options.environment ?? process.env.NODE_ENV);
  const password = demoPassword(options.password);
  const passwordHash = await bcrypt.hash(password, 10);
  return db.$transaction(
    async (tx) => {
      // Keep all demo records atomic and concurrent invocations idempotent.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4719033)`;
      // Preflight every reserved identity before creating or modifying anything.
      for (const account of demoAccounts) {
        const existing = await tx.user.findUnique({
          where: { email: account.email },
        });
        if (
          existing &&
          (existing.role !== account.role ||
            !existing.fullname.startsWith('[DEMO]') ||
            !(await bcrypt.compare(password, existing.password)))
        ) {
          throw new Error(
            'A reserved demo email belongs to a different/changed account; refusing to replace credentials or role.',
          );
        }
      }
      const users = [];
      for (const account of demoAccounts) {
        users.push(
          await tx.user.upsert({
            where: { email: account.email },
            update: {},
            create: {
              ...account,
              password: passwordHash,
              yob: new Date('2008-06-15T00:00:00Z'),
              ...(account.role === 'USER'
                ? {
                    class: 12,
                    address: '[DEMO] Thành phố Hồ Chí Minh',
                    gender: 'OTHER',
                  }
                : {}),
            },
          }),
        );
      }
      const owner = users.find((user) => user.role === 'USER')!;
      const questions = await tx.question.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, content: true, type: true, dimension: true },
      });
      if (
        !questions.length ||
        questions.some((q) => !RIASEC_KEYS.includes(q.type as RiasecCode)) ||
        RIASEC_KEYS.some((code) => !questions.some((q) => q.type === code))
      )
        throw new Error(
          'Seed the complete Holland question bank before demo data.',
        );
      const priorities = await tx.priority.findMany({
        orderBy: { priority: 'asc' },
      });
      if (
        priorities.length !== 6 ||
        new Set(priorities.map((p) => p.type)).size !== 6 ||
        new Set(priorities.map((p) => p.priority)).size !== 6
      )
        throw new Error('Valid Holland tie priorities are required.');
      const calculator = new ScoreCalculatorService();
      const attempts = [];
      const patterns: RiasecScore[] = [
        { R: 4, I: 10, A: 5, S: 8, E: 3, C: 6 },
        { R: 5, I: 14, A: 9, S: 11, E: 4, C: 7 },
      ];
      for (const [index, preferred] of patterns.entries()) {
        const seedKey = `aihn-demo-assessment-v1-${index}`;
        let attempt = await tx.attempt.findFirst({
          where: {
            userId: owner.id,
            snapshots: {
              is: { snapshot: { path: ['seedKey'], equals: seedKey } },
            },
          },
          include: { result: true, snapshots: true },
        });
        if (!attempt) {
          const seen: Record<string, number> = {};
          const snapshotQuestions = questions.map((q) => ({
            ...q,
            answerValue:
              (seen[q.type] = (seen[q.type] ?? 0) + 1) <= preferred[q.type]
                ? 1
                : 0,
          }));
          const { score } = calculator.calculateScores(
            snapshotQuestions
              .filter((q) => q.answerValue === 1)
              .map((q) => ({ type: q.type as RiasecCode })),
          );
          const topCode = [...priorities]
            .sort(
              (a, b) =>
                score[b.type] - score[a.type] || a.priority - b.priority,
            )
            .slice(0, 3)
            .map((p) => p.type)
            .join('');
          const result = {
            scoreR: score.R,
            scoreI: score.I,
            scoreA: score.A,
            scoreS: score.S,
            scoreE: score.E,
            scoreC: score.C,
            topCode,
          };
          const createdAt = new Date(
            Date.now() - (index === 0 ? 3 : 1) * 86400000,
          );
          attempt = await tx.attempt.create({
            data: {
              userId: owner.id,
              totalQuestions: questions.length,
              createdAt,
              finishAt: new Date(createdAt.getTime() + 900000),
              answers: {
                create: snapshotQuestions.map((q) => ({
                  questionId: q.id,
                  answerValue: q.answerValue,
                })),
              },
              result: { create: result },
              snapshots: {
                create: {
                  snapshot: { seedKey, result, questions: snapshotQuestions },
                },
              },
            },
            include: { result: true, snapshots: true },
          });
        }
        attempts.push(attempt);
      }
      const careers = await tx.career.findMany({
        where: { active: true },
        include: careerInclude,
        orderBy: { id: 'asc' },
      });
      const target =
        careers.find((career) => career.id === '15-1252.00') ?? careers[0];
      if (!target)
        throw new Error('Import a published career catalog before demo data.');
      const profile = await tx.careerProfile.upsert({
        where: { userId: owner.id },
        update: {},
        create: {
          userId: owner.id,
          targetCareerId: target.id,
          skills: target.skills
            .slice(0, 4)
            .map((skill) => ({ skillId: skill.skillId, level: 2 })),
          interests: { R: 1, I: 5, A: 3, S: 3, E: 2, C: 3 },
        },
      });
      const attempt = attempts[1],
        r = attempt.result!;
      const scores = {
        R: r.scoreR,
        I: r.scoreI,
        A: r.scoreA,
        S: r.scoreS,
        E: r.scoreE,
        C: r.scoreC,
      };
      const normalized = normalizeSnapshot(attempt.snapshots?.snapshot, scores);
      if (!normalized)
        throw new Error('Demo assessment snapshot is not comparable.');
      const inputProfile = profileData(profile);
      const runKey = 'aihn-demo-recommendations-v1';
      let run = await tx.recommendationRun.findFirst({
        where: {
          userId: owner.id,
          input: { path: ['seedKey'], equals: runKey },
        },
      });
      if (!run)
        run = await tx.recommendationRun.create({
          data: {
            userId: owner.id,
            attemptId: attempt.id,
            algorithmVersion,
            input: {
              seedKey: runKey,
              scores,
              normalized,
              profileRevision: profile.revision,
              profile: inputProfile,
              catalog: careers.map((c) => ({
                id: c.id,
                revision: c.revision,
                sourceVersion: c.sourceVersion,
              })),
            } as unknown as Prisma.InputJsonValue,
            items: rankCareers(
              normalized,
              inputProfile,
              careers.map(scoringCareer),
            ).slice(0, 20) as unknown as Prisma.InputJsonValue,
          },
        });
      const goalTarget = careers.find((c) => c.id === profile.targetCareerId);
      if (goalTarget) {
        const career = scoringCareer(goalTarget);
        const names = new Map(
          (await tx.skill.findMany()).map((skill) => [skill.id, skill.name]),
        );
        const tasks = planRoadmap(career, inputProfile, names).map((task) => ({
          ...task,
          done: task.phase === 0,
          evidence:
            task.phase === 0
              ? '[DEMO] Minh chứng minh họa do seeder tạo, không phải hoàn thành thực tế.'
              : '',
        }));
        await tx.careerGoal.upsert({
          where: { userId_careerId: { userId: owner.id, careerId: career.id } },
          update: {},
          create: {
            userId: owner.id,
            careerId: career.id,
            title: `[DEMO] ${career.title}`,
            evidence: {
              seedKey: 'aihn-demo-roadmap-v1',
              profileRevision: profile.revision,
              sourceVersion: career.sourceVersion,
              sourceUrl: career.sourceUrl,
              gaps: skillGaps(career.skills, inputProfile),
            } as unknown as Prisma.InputJsonValue,
            tasks: { create: tasks },
          },
        });
      }
      const socketId = `seed:aihn-demo-chat-v1:${owner.id}`;
      let chat = await tx.chatSession.findFirst({
        where: { userId: owner.id, socketId },
      });
      if (!chat)
        chat = await tx.chatSession.create({
          data: {
            userId: owner.id,
            attemptId: attempt.id,
            socketId,
            status: 'CLOSED',
            closedAt: new Date(),
            title: '[DEMO] Hội thoại minh họa',
            messages: {
              create: [
                {
                  role: 'user',
                  content:
                    '[DEMO] Tôi muốn xem cách đọc lại một hội thoại định hướng nghề nghiệp.',
                },
                {
                  role: 'assistant',
                  content:
                    '[DEMO] Đây là nội dung minh họa do seeder tạo để xem giao diện lịch sử, không phải phản hồi từ dịch vụ AI. Bạn có thể xem điểm Holland, nguồn nghề và lộ trình đã khởi tạo trong tài khoản demo.',
                },
              ],
            },
          },
        });
      return {
        accounts: users.map((user) => ({ email: user.email, role: user.role })),
        studentId: owner.id,
        attemptIds: attempts.map((a) => a.id),
        recommendationId: run.id,
        chatSessionId: chat.id,
      };
    },
    { timeout: 120000, maxWait: 10000 },
  );
}
