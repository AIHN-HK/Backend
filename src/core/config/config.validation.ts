import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_VERSION: Joi.string().default('v1'),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('', null).optional(),
  AI_WS_URL: Joi.string()
    .uri({ scheme: ['ws', 'wss'] })
    .optional(),
  AI_CONNECT_TIMEOUT_MS: Joi.number().integer().min(100).default(10000),
  AI_IDLE_TIMEOUT_MS: Joi.number().integer().min(100).default(30000),
  AI_MAX_DURATION_MS: Joi.number().integer().min(100).default(120000),
  CHAT_TURN_LEASE_MS: Joi.number().integer().min(3000).default(600000),
  CORS_ORIGINS: Joi.string().optional(),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
  LOGIN_MAX_CONCURRENT: Joi.number().integer().min(1).default(20),
  LOGIN_QUEUE_MAX_WAIT_MS: Joi.number().integer().min(1).default(1500),
  LOGIN_SLOT_LEASE_MS: Joi.number().integer().min(1000).default(30000),
  LOGIN_QUEUE_POLL_INTERVAL_MS: Joi.number().integer().min(10).default(50),
  ANSWER_V2_LOCK_TTL_MS: Joi.number().integer().min(1000).default(5000),
  ANSWER_V2_LOCK_WAIT_MS: Joi.number().integer().min(1).default(800),
  ANSWER_V2_LOCK_POLL_MS: Joi.number().integer().min(10).default(40),
  REGISTER_LOCK_TTL_MS: Joi.number().integer().min(1000).default(5000),
  REGISTER_LOCK_WAIT_MS: Joi.number().integer().min(1).default(500),
  REGISTER_LOCK_POLL_MS: Joi.number().integer().min(10).default(40),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
});
