import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  importCareerData,
  readCareerDataset,
} from '../scripts/import-career-data';
import { seedReferenceData } from './seed-reference';
import { seedDemoData, assertDemoEnvironment, demoPassword } from './seed-demo';

export async function seedDatabase(
  db: PrismaClient,
  options: { demo?: boolean; environment?: string; password?: string } = {},
) {
  if (options.demo) {
    assertDemoEnvironment(options.environment ?? process.env.NODE_ENV);
    demoPassword(options.password);
  }
  // Validate the checked-in corpus before writing any initial data.
  readCareerDataset();
  const reference = await seedReferenceData(db);
  const careers = await importCareerData(db);
  const demo = options.demo ? await seedDemoData(db, options) : undefined;
  return { reference, careers, ...(demo ? { demo } : {}) };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--demo')) {
    console.error('Usage: seed.ts [--demo]');
    process.exitCode = 1;
  } else {
    const db = new PrismaClient();
    seedDatabase(db, {
      demo: args.includes('--demo'),
      password: process.env.SEED_DEMO_PASSWORD,
    })
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch(() => {
        console.error(
          'Seed failed. Check configuration/data and rerun; existing records are not reset.',
        );
        process.exitCode = 1;
      })
      .finally(() => db.$disconnect());
  }
}
