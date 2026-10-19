import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async bounded(check: () => Promise<unknown>) {
    let timer: NodeJS.Timeout;
    try {
      await Promise.race([
        Promise.resolve().then(check),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Dependency timeout')),
            2500,
          );
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async readiness() {
    const [database, redis] = await Promise.all([
      this.bounded(() => this.prisma.$queryRaw`SELECT 1`),
      this.bounded(() => this.redis.ping()),
    ]);
    const checks = { database, redis };
    if (!database || !redis)
      throw new ServiceUnavailableException({ code: 'NOT_READY', checks });
    return { status: 'ready', checks };
  }
}
