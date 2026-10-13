import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { RedisService } from './redis/redis.service';
import { redisOptions } from './config/redis.options';
import { recordAdminAudit } from '../modules/audit/admin-audit';
import { allowedOrigins } from './config/cors.options';

describe('request completion logs', () => {
  it('logs the final status once and omits credentials and query strings', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const response: any = Object.assign(new EventEmitter(), {
        statusCode: 200,
        writableFinished: true,
        setHeader: jest.fn(),
      });
      new LoggingMiddleware().use(
        {
          method: 'POST',
          path: '/auth/login',
          body: { password: 'private' },
          originalUrl: '/auth/login?otp=private',
        } as any,
        response,
        () => {},
      );
      expect(spy).not.toHaveBeenCalled();
      response.statusCode = 401;
      response.emit('finish');
      response.emit('close');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatchObject({
        status: 401,
        aborted: false,
        requestId: expect.any(String),
      });
      expect(JSON.stringify(spy.mock.calls)).not.toContain('private');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Prisma HTTP errors', () => {
  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2025', 404],
    ['P2034', 409],
    ['P2024', 500],
  ])('maps %s to %s without exposing database details', (code, status) => {
    const spy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      const response: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      new HttpExceptionFilter().catch(
        new Prisma.PrismaClientKnownRequestError('password=private', {
          code,
          clientVersion: 'fixture',
        }),
        {
          switchToHttp: () => ({
            getRequest: () => ({
              method: 'POST',
              path: '/fixture',
              requestId: 'test',
            }),
            getResponse: () => response,
          }),
        } as any,
      );
      expect(response.status).toHaveBeenCalledWith(status);
      expect(
        JSON.stringify([response.json.mock.calls, spy.mock.calls]),
      ).not.toContain('private');
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });
});

describe('optional Redis caching', () => {
  it('uses an explicit origin list and defaults production CORS to closed', () => {
    expect(allowedOrigins(undefined, true)).toBe(false);
    expect(
      allowedOrigins('http://localhost:3000, http://localhost:5173'),
    ).toEqual(['http://localhost:3000', 'http://localhost:5173']);
  });
  it.each(['offline', 'invalid-json'])(
    'uses authoritative fallback for %s',
    async (mode) => {
      const fallback = jest.fn(async () => ({ current: true }));
      const redis: any = {
        get: async () => {
          if (mode === 'offline') throw new Error('offline');
          return 'invalid';
        },
        setex: async () => {
          throw new Error('offline');
        },
      };
      await expect(
        new RedisService(redis).getOrSet('fixture', 10, fallback),
      ).resolves.toEqual({ current: true });
      expect(fallback).toHaveBeenCalledTimes(1);
    },
  );
  it('shares authenticated connection settings with queue configuration', () => {
    expect(
      redisOptions(
        new ConfigService({
          REDIS_HOST: 'fixture',
          REDIS_PORT: 6380,
          REDIS_PASSWORD: 'password',
        }),
      ),
    ).toMatchObject({ host: 'fixture', port: 6380, password: 'password' });
  });
});

describe('admin audit projection', () => {
  it('records actor and public before/after without unrelated sensitive fields', async () => {
    const create = jest.fn(async (data) => data);
    await recordAdminAudit(
      { adminAuditLog: { create } } as any,
      12,
      'Question',
      'updated',
      '1',
      { id: 1, content: 'Before', password: 'private' },
      { id: 1, content: 'After', token: 'private' },
    );
    expect(create.mock.calls[0][0].data).toMatchObject({
      actorId: 12,
      before: { id: 1, content: 'Before' },
      after: { id: 1, content: 'After' },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain('private');
  });
});
