import { HealthService } from './health.service';

describe('readiness', () => {
  it('requires both database and Redis', async () => {
    const service = new HealthService(
      { $queryRaw: async () => [1] } as any,
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
          $queryRaw: dependency === 'database' ? failure : async () => [1],
        } as any,
        { ping: dependency === 'redis' ? failure : async () => 'PONG' } as any,
      );
      await expect(service.readiness()).rejects.toMatchObject({ status: 503 });
    },
  );
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
