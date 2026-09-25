import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Redis from 'ioredis';

@Injectable()
export class LoginConcurrencyGuard implements CanActivate {
  private readonly key = 'auth:login:concurrency';
  private readonly maxConcurrent = Number(
    process.env.LOGIN_MAX_CONCURRENT ?? 20,
  );

  private readonly maxWaitMs = Number(
    process.env.LOGIN_QUEUE_MAX_WAIT_MS ?? 1500,
  );
  private readonly leaseMs = Number(process.env.LOGIN_SLOT_LEASE_MS ?? 30000);
  private readonly pollIntervalMs = Number(
    process.env.LOGIN_QUEUE_POLL_INTERVAL_MS ?? 50,
  );

  private static readonly ACQUIRE_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local maxConcurrent = tonumber(ARGV[2])
local leaseMs = tonumber(ARGV[3])
local token = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
local current = redis.call('ZCARD', key)

if current < maxConcurrent then
  redis.call('ZADD', key, now + leaseMs, token)
  redis.call('PEXPIRE', key, leaseMs)
  return 1
end

return 0
`;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const token = this.createToken(req);
    const acquired = await this.acquireWithWait(token);

    if (!acquired) {
      res.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(this.maxWaitMs / 1000))),
      );
      throw new HttpException(
        'Server dang ban, vui long thu lai sau it giay.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.registerAutoRelease(res, token);
    return true;
  }

  private async acquireWithWait(token: string): Promise<boolean> {
    const deadline = Date.now() + this.maxWaitMs;

    while (Date.now() <= deadline) {
      const acquired = await this.tryAcquire(token);
      if (acquired) {
        return true;
      }
      await this.sleep(this.pollIntervalMs);
    }

    return false;
  }

  private async tryAcquire(token: string): Promise<boolean> {
    const result = await this.redis.eval(
      LoginConcurrencyGuard.ACQUIRE_SCRIPT,
      1,
      this.key,
      String(Date.now()),
      String(this.maxConcurrent),
      String(this.leaseMs),
      token,
    );

    return Number(result) === 1;
  }

  private registerAutoRelease(res: Response, token: string) {
    let released = false;

    const release = async () => {
      if (released) {
        return;
      }
      released = true;
      try {
        await this.redis.zrem(this.key, token);
      } catch (err) {
        console.error('Failed to release login slot:', err);
      }
    };

    res.on('finish', () => {
      void release();
    });
    res.on('close', () => {
      void release();
    });
  }

  private createToken(req: Request): string {
    return `${Date.now()}:${Math.random().toString(36).slice(2)}:${req.ip}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
