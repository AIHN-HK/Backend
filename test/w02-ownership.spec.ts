import { ChatService } from '../src/modules/chat/chat.service';
import { ChatGateway } from '../src/modules/chat/chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { LoggingMiddleware } from '../src/core/middleware/logging.middleware';

describe('chat ownership', () => {
  it('another user cannot read session messages', async () => {
    const s = new ChatService(
      {
        chatSession: { findUnique: async () => ({ userId: 2 }) },
        chatMessage: { findMany: async () => [{ content: 'private' }] },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect((s.getMessage as any)(10, 1)).rejects.toMatchObject({
      status: 403,
    });
  });
  it.each(['handleMessage', 'handleAsk', 'handleStop'])(
    '%s cannot join, write, queue, or stop another session',
    async (method) => {
      const s = new ChatService(
        { chatSession: { findUnique: async () => ({ userId: 2 }) } } as any,
        {
          stopGeneration: () => {
            throw new Error('stopped without authorization');
          },
        } as any,
        {} as any,
        {} as any,
      );
      const jwt = new JwtService({ secret: 'w02-socket-only' });
      const g = new ChatGateway(
        s,
        { user: { findUnique: async () => ({ id: 1 }) } } as any,
        jwt,
        {
          add: async () => {
            throw new Error('queued without authorization');
          },
        } as any,
      );
      const socket: any = {
        handshake: { auth: { token: jwt.sign({ userId: 1 }) } },
        data: { user: { userId: 1 }, sessionId: 1 },
        emit: () => {},
        join: () => {
          throw new Error('joined without authorization');
        },
        leave: () => {
          throw new Error('left own room');
        },
      };
      await (g[method] as any)({ sessionId: 10, content: 'test' }, socket);
      expect(socket.data.sessionId).toBe(1);
    },
  );
});
describe('credential logging', () => {
  it('middleware omits request bodies and query secrets', () => {
    const output: string[] = [];
    const spy = jest
      .spyOn(console, 'log')
      .mockImplementation((x) => output.push(JSON.stringify(x)));
    try {
      new LoggingMiddleware().use(
        {
          method: 'POST',
          ip: 'test',
          originalUrl: '/auth/login?otp=123456',
          path: '/auth/login',
          body: { password: 'secret', otp: '123456' },
        } as any,
        { statusCode: 200 } as any,
        () => {},
      );
      expect(output.join('')).not.toContain('secret');
      expect(output.join('')).not.toContain('123456');
    } finally {
      spy.mockRestore();
    }
  });
});
