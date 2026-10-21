import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { Prisma } from '@prisma/client';

type DatabaseColumn = { table_name: string; column_name: string };

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
      this.bounded(async () => {
        const columns = await this.prisma.$queryRaw<DatabaseColumn[]>`
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
        `;
        const available = new Set(
          columns.map((column) => `${column.table_name}.${column.column_name}`),
        );
        for (const model of Prisma.dmmf.datamodel.models) {
          for (const field of model.fields) {
            if (field.kind === 'object') continue;
            if (
              !available.has(
                `${model.dbName ?? model.name}.${field.dbName ?? field.name}`,
              )
            )
              throw new Error('Database schema does not match the application');
          }
        }
      }),
      this.bounded(() => this.redis.ping()),
    ]);
    const checks = { database, redis };
    if (!database || !redis)
      throw new ServiceUnavailableException({ code: 'NOT_READY', checks });
    return { status: 'ready', checks };
  }
}
