import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class AnswerSubmitLockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async withAttemptLock<T>(
    attemptId: number,
    fn: () => Promise<T>,
    opt?: { ttlMs?: number; waitMs?: number; pollMs?: number },
  ): Promise<T> {
    const ttlMs =
      opt?.ttlMs ?? Number(process.env.ANSWER_V2_LOCK_TTL_MS ?? 5000);
    const waitMs =
      opt?.waitMs ?? Number(process.env.ANSWER_V2_LOCK_WAIT_MS ?? 800);
    const pollMs =
      opt?.pollMs ?? Number(process.env.ANSWER_V2_LOCK_POLL_MS ?? 40);
    const key = `lock:answer:submit-v2:${attemptId}`;
    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + waitMs;

    let locked = false;
    while (Date.now() <= deadline) {
      const ok = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
      if (ok === 'OK') {
        locked = true;
        break;
      }
      await this.sleep(pollMs);
    }

    if (!locked) {
      throw new HttpException(
        'System is processing your submission, please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('already completed') || err?.code === 'P2002') {
        throw new ConflictException('attempt has already been completed');
      }

      throw err;
    } finally {
      try {
        await this.safeRelease(key, token);
      } catch (err) {
        console.error('Failed to release answer submit lock:', err);
      }
    }
  }

  private async safeRelease(key: string, token: string): Promise<void> {
    const lua = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;
    await this.redis.eval(lua, 1, key, token);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
