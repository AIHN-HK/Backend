import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class ChatTurnService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}
  private key(sessionId: number) {
    return `chat:turn:${sessionId}`;
  }
  private get leaseMs() {
    return this.config.get<number>('CHAT_TURN_LEASE_MS', 600000);
  }

  async reserve(sessionId: number) {
    const turnId = randomUUID();
    const claimed = await this.redis.set(
      this.key(sessionId),
      turnId,
      'PX',
      this.leaseMs,
      'NX',
    );
    if (claimed !== 'OK')
      throw new ConflictException('A turn is already queued or active.');
    return turnId;
  }

  async isCurrent(sessionId: number, turnId: string) {
    const [current, cancelled] = await Promise.all([
      this.redis.get(this.key(sessionId)),
      this.redis.get(`chat:cancel:${turnId}`),
    ]);
    return current === turnId && !cancelled;
  }

  async renew(sessionId: number, turnId: string) {
    return this.redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end return 0",
      1,
      this.key(sessionId),
      turnId,
      this.leaseMs,
    );
  }

  async cancel(sessionId: number) {
    const turnId = await this.redis.get(this.key(sessionId));
    if (turnId)
      await this.redis.set(`chat:cancel:${turnId}`, '1', 'PX', this.leaseMs);
    return turnId;
  }

  async release(sessionId: number, turnId: string) {
    await this.redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
      1,
      this.key(sessionId),
      turnId,
    );
  }
}
