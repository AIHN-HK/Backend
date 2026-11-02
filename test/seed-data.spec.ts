import { seedDatabase } from '../prisma/seed';
import {
  assertDemoEnvironment,
  demoPassword,
  defaultDemoPassword,
} from '../prisma/seed-demo';
import {
  hollandQuestions,
  hollandPriorities,
  topCodeProfiles,
  hollandCases,
} from '../prisma/seed-data';
import { PrismaClient } from '@prisma/client';

describe('reproducible initial data', () => {
  it('retains all 108 canonical questions and six complete RIASEC groups', () => {
    expect(hollandQuestions).toHaveLength(108);
    expect(
      new Set(
        hollandQuestions.map((q) =>
          JSON.stringify([q.content, q.type, q.dimension]),
        ),
      ).size,
    ).toBe(108);
    for (const type of ['R', 'I', 'A', 'S', 'E', 'C']) {
      const group = hollandQuestions.filter((q) => q.type === type);
      expect(group).toHaveLength(18);
      expect(new Set(group.map((q) => q.dimension))).toEqual(
        new Set(['PERSONA', 'ABILITY', 'INTEREST']),
      );
    }
    expect(topCodeProfiles).toHaveLength(6);
    expect(new Set(hollandPriorities.map((p) => p.priority)).size).toBe(6);
    expect(hollandCases.length).toBeGreaterThan(0);
  });
  it('blocks demo data in production before touching the selected database', async () => {
    const transaction = jest.fn();
    await expect(
      seedDatabase({ $transaction: transaction } as unknown as PrismaClient, {
        demo: true,
        environment: 'production',
      }),
    ).rejects.toThrow('disabled in production');
    expect(transaction).not.toHaveBeenCalled();
    expect(() => assertDemoEnvironment('development')).not.toThrow();
  });
  it('validates demo passwords before any reference data writes', async () => {
    expect(demoPassword('')).toBe(defaultDemoPassword);
    const transaction = jest.fn();
    await expect(
      seedDatabase({ $transaction: transaction } as unknown as PrismaClient, {
        demo: true,
        environment: 'test',
        password: 'short',
      }),
    ).rejects.toThrow('12+');
    expect(transaction).not.toHaveBeenCalled();
    expect(() => demoPassword('ắ'.repeat(30))).toThrow('72 UTF-8 bytes');
  });
});
