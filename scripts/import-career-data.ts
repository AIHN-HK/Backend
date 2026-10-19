import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vector } from '../src/modules/career/domain/scoring';

export function readCareerDataset() {
  const raw = readFileSync(resolve('data/career-dataset.json'));
  const manifest = JSON.parse(
    readFileSync(resolve('data/career-manifest.json'), 'utf8'),
  );
  if (createHash('sha256').update(raw).digest('hex') !== manifest.datasetSha256)
    throw new Error('Dataset checksum mismatch');
  const data = JSON.parse(raw.toString()) as {
    version: string;
    skills: { id: string; name: string }[];
    careers: {
      id: string;
      title: string;
      description: string;
      riasec: Record<string, number>;
      sourceVersion: string;
      sourceUrl: string;
      skills: { skillId: string; importance: number; level: number }[];
    }[];
  };
  if (
    data.careers.length !== manifest.careers ||
    data.skills.length !== manifest.skills ||
    data.careers.length > 2000 ||
    data.skills.length > 35
  )
    throw new Error('Invalid dataset size');
  const skills = new Set(data.skills.map((s) => s.id));
  if (
    skills.size !== data.skills.length ||
    new Set(data.careers.map((c) => c.id)).size !== data.careers.length
  )
    throw new Error('Duplicate data IDs');
  for (const career of data.careers) {
    if (
      !/^\d{2}-\d{4}\.\d{2}$/.test(career.id) ||
      !career.title ||
      !career.description ||
      !vector(career.riasec, 7) ||
      career.sourceUrl !==
        `https://www.onetonline.org/link/summary/${career.id}` ||
      career.sourceVersion !== data.version ||
      career.skills.length > 8
    )
      throw new Error('Invalid career row');
    if (
      new Set(career.skills.map((s) => s.skillId)).size !==
        career.skills.length ||
      career.skills.some(
        (s) =>
          !skills.has(s.skillId) ||
          !Number.isFinite(s.importance) ||
          s.importance <= 0 ||
          s.importance > 5 ||
          !Number.isFinite(s.level) ||
          s.level < 0 ||
          s.level > 5,
      )
    )
      throw new Error('Invalid career skill row');
  }
  return data;
}
export async function importCareerData(db: PrismaClient) {
  const data = readCareerDataset();
  await db.$transaction(
    async (tx) => {
      // One importer per database; lock held until commit/rollback.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4719031)`;
      for (const skill of data.skills)
        await tx.skill.upsert({
          where: { id: skill.id },
          create: skill,
          update: { name: skill.name },
        });
      for (const { skills, ...row } of data.careers) {
        await tx.career.upsert({
          where: { id: row.id },
          create: { ...row, skills: { create: skills } },
          update: {
            ...row,
            revision: { increment: 1 },
            skills: { deleteMany: {}, create: skills },
          },
        });
      }
    },
    { timeout: 120000, maxWait: 10000 },
  );
  return {
    version: data.version,
    careers: data.careers.length,
    skills: data.skills.length,
  };
}
if (require.main === module) {
  const db = new PrismaClient();
  importCareerData(db)
    .then((result) => console.log(result))
    .catch(() => {
      console.error('Career import failed; transaction rolled back.');
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
