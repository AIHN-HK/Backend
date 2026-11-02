// src/core/redis/redis.service.ts
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}
  async onModuleDestroy() {
    if (this.redis.status === 'ready') {
      await this.redis.quit().catch(() => undefined);
    }
    this.redis.disconnect();
  }
  async ping() {
    return this.redis.ping();
  }
  async set(key: string, value: string) {
    return this.redis.set(key, value);
  }
  async get(key: string) {
    return this.redis.get(key);
  }

  async setEx(key: string, ttlSeconds: number, value: string) {
    return this.redis.setex(key, ttlSeconds, value);
  }
  async del(key: string) {
    return this.redis.del(key);
  }

  //  Xóa nhiều keys theo pattern (dùng SCAN để an toàn)
  async delByPattern(pattern: string) {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      if (keys.length) await this.redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  }

  // Helper tiện lợi: thử lấy cache, nếu miss thì fallback + cache lại
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      // Only optional read caching fails open; locks/queue retain their own errors.
    }

    const data = await fallback();

    await this.redis
      .setex(key, ttlSeconds, JSON.stringify(data))
      .catch(() => undefined);

    return data;
  }

  // async incr(key: string) {
  //   return this.redis.incr(key);
  // }

  /** Lấy thời gian sống của key */
  async ttl(key: string) {
    return this.redis.ttl(key);
  }

  // async expire(key: string, ttlSeconds: number) {
  //   return this.redis.expire(key, ttlSeconds);
  // }
}
