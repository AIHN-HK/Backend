// src/core/redis/redis.service.ts
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}
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
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Helper tiện lợi: thử lấy cache, nếu miss thì fallback + cache lại
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fallback: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fallback();

    await this.redis.setex(key, ttlSeconds, JSON.stringify(data));

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
