import { PrismaClient } from '@prisma/client';
import {
  hollandCases,
  hollandPriorities,
  hollandQuestions,
  topCodeDescriptions,
  topCodeProfiles,
} from './seed-data';

export async function seedReferenceData(db: PrismaClient) {
  return db.$transaction(
    async (tx) => {
      // Question has no natural unique constraint; serialize seed discovery/insertion.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4719032)`;
      const priorities = await tx.priority.findMany();
      if (
        priorities.some(
          (p) =>
            !hollandPriorities.some((seed) => seed.type === p.type) ||
            p.priority < 1 ||
            p.priority > 6,
        ) ||
        new Set(priorities.map((p) => p.priority)).size !== priorities.length
      ) {
        throw new Error(
          'Existing Holland priorities are invalid; review them before seeding.',
        );
      }
      const usedRanks = new Set(priorities.map((p) => p.priority));
      for (const row of hollandPriorities) {
        if (priorities.some((p) => p.type === row.type)) continue;
        const priority = !usedRanks.has(row.priority)
          ? row.priority
          : [1, 2, 3, 4, 5, 6].find((rank) => !usedRanks.has(rank))!;
        await tx.priority.create({ data: { type: row.type, priority } });
        usedRanks.add(priority);
      }
      for (const row of topCodeProfiles) {
        await tx.topCode.upsert({
          where: { code: row.code },
          update: {},
          create: {
            ...row,
            description: topCodeDescriptions.find(
              (item) => item.code === row.code,
            )?.description,
          },
        });
      }
      for (const row of hollandCases) {
        await tx.hollandCase.upsert({
          where: { code: row.code },
          update: {},
          create: row,
        });
      }
      const identity = (q: {
        content: string;
        type: string;
        dimension?: string | null;
      }) => JSON.stringify([q.content, q.type, q.dimension ?? null]);
      const existing = new Set(
        (
          await tx.question.findMany({
            select: { content: true, type: true, dimension: true },
          })
        ).map(identity),
      );
      const missing = hollandQuestions.filter(
        (q) => !existing.has(identity(q)),
      );
      if (missing.length) await tx.question.createMany({ data: missing });
      return {
        questionsAdded: missing.length,
        questions: await tx.question.count(),
        topCodes: await tx.topCode.count(),
        hollandCases: await tx.hollandCase.count(),
        priorities: await tx.priority.count(),
      };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
