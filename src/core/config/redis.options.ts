import { ConfigService } from '@nestjs/config';

export function redisOptions(config: ConfigService) {
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: Number(config.get<number>('REDIS_PORT', 6379)),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    connectTimeout: 2000,
  };
}
