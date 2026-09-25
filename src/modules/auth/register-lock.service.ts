import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';

@Injectable()
export class RegisterLockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async withEmailLock<T>(
    email: string,
    fn: () => Promise<T>,
    opt?: { ttlMs?: number; waitMs?: number; pollMs?: number },
  ): Promise<T> {
    const ttlMs =
      opt?.ttlMs ?? Number(process.env.REGISTER_LOCK_TTL_MS ?? 60000);
    const waitMs =
      opt?.waitMs ?? Number(process.env.REGISTER_LOCK_WAIT_MS ?? 500);
    const pollMs =
      opt?.pollMs ?? Number(process.env.REGISTER_LOCK_POLL_MS ?? 40);

    const emailNormalized = email.trim().toLowerCase();
    const key = `lock:auth:register:${emailNormalized}`;
    const token = `${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const start = Date.now();

    while (Date.now() - start < waitMs) {
      const ok = await this.redis.set(key, token, 'PX', ttlMs, 'NX');

      if (ok === 'OK') {
        try {
          return await fn();
        } catch (err: any) {
          if (String(err?.message || '').includes('Email already exists')) {
            throw new ConflictException('email has already been registered');
          }

          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            throw new ConflictException('email has already been registered');
          }

          throw err;
        } finally {
          try {
            await this.safeRelease(key, token);
          } catch (err) {
            console.error('Failed to release register lock:', err);
          }
        }
      }

      await this.sleep(pollMs);
    }

    throw new HttpException(
      'Yeu cau dang ky dang duoc xu ly, vui long thu lai.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async safeRelease(key: string, token: string): Promise<void> {
    const lua = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;
    await this.redis.eval(lua, 1, key, token);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
