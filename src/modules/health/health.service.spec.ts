import { HealthService } from './health.service';
import { Prisma } from '@prisma/client';

const schemaColumns = Prisma.dmmf.datamodel.models.flatMap((model) =>
  model.fields
    .filter((field) => field.kind !== 'object')
    .map((field) => ({
      table_name: model.dbName ?? model.name,
      column_name: field.dbName ?? field.name,
    })),
);

describe('readiness', () => {
  it('requires both database and Redis', async () => {
    const service = new HealthService(
      { $queryRaw: async () => schemaColumns } as any,
      { ping: async () => 'PONG' } as any,
    );
    await expect(service.readiness()).resolves.toEqual({
      status: 'ready',
      checks: { database: true, redis: true },
    });
  });
  it.each(['database', 'redis'])(
    'returns 503 for %s failure',
    async (dependency) => {
      const failure = async () => {
        throw new Error('private connection details');
      };
      const service = new HealthService(
        {
          $queryRaw:
            dependency === 'database' ? failure : async () => schemaColumns,
        } as any,
        { ping: dependency === 'redis' ? failure : async () => 'PONG' } as any,
      );
      await expect(service.readiness()).rejects.toMatchObject({ status: 503 });
    },
  );
  it.each([
    ['Otp', 'failedAttempts'],
    ['Career', 'id'],
    ['AdminAuditLog', 'id'],
  ])('rejects a reachable database missing %s.%s', async (table, column) => {
    const service = new HealthService(
      {
        $queryRaw: async () =>
          schemaColumns.filter(
            (field) =>
              field.table_name !== table || field.column_name !== column,
          ),
      } as any,
      { ping: async () => 'PONG' } as any,
    );
    await expect(service.readiness()).rejects.toMatchObject({
      status: 503,
      response: {
        code: 'NOT_READY',
        checks: { database: false, redis: true },
      },
    });
  });
  it('bounds an unresponsive dependency', async () => {
    jest.useFakeTimers();
    try {
      const service = new HealthService(
        { $queryRaw: () => new Promise(() => {}) } as any,
        { ping: async () => 'PONG' } as any,
      );
      const check = expect(service.readiness()).rejects.toMatchObject({
        status: 503,
      });
      await jest.advanceTimersByTimeAsync(2501);
      await check;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
