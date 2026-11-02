import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { redisOptions } from '../config/redis.options';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const redis = new Redis({
          ...redisOptions(config),
          maxRetriesPerRequest: 1,
          commandTimeout: 2000,
          enableOfflineQueue: false,
        });

        redis.on('connect', () => {
          logger.log('Redis connected');
        });

        redis.on('error', () => {
          logger.error('Redis connection unavailable');
        });

        return redis;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService], // 👈 thêm dòng này
})
export class RedisModule {}
