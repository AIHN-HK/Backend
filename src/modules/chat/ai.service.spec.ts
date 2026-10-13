import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { AiService, AiStreamInput } from './ai.service';

class FakeSocket extends EventEmitter {
  readyState = 1;
  close = jest.fn(() => {
    this.readyState = 3;
    this.emit('close');
  });
  terminate = this.close;
  send = jest.fn((_body, callback) => callback?.());
}

describe('AI stream lifecycle', () => {
  function setup(values: Record<string, unknown> = {}) {
    const sockets: FakeSocket[] = [];
    const factory = jest.fn(() => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as any;
    });
    const service = new AiService(
      new ConfigService({ AI_WS_URL: 'ws://127.0.0.1:9000', ...values }),
      factory,
    );
    const input: AiStreamInput = {
      sessionId: 1,
      turnId: 'a',
      message: 'fixture',
      profile_json: {},
      test_json: {},
      history: [],
      onToken: jest.fn(),
    };
    return { service, sockets, factory, input };
  }

  it('ends successfully once and ignores frames after completion', async () => {
    const { service, sockets, input } = setup();
    const pending = service.streamAsk(input);
    const socket = sockets[0];
    socket.emit('open');
    socket.emit('message', Buffer.from('{"type":"token","content":"Hello"}'));
    socket.emit('message', Buffer.from('{"type":"end"}'));
    socket.emit('message', Buffer.from('{"type":"token","content":"late"}'));
    await expect(pending).resolves.toBe('completed');
    expect(input.onToken).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['close', undefined, 'AI_CONNECTION_CLOSED'],
    ['message', 'not-json', 'AI_PROTOCOL_ERROR'],
    ['message', '{"type":"token","content":false}', 'AI_PROTOCOL_ERROR'],
    ['message', '{"type":"error","content":"private-data"}', 'AI_REMOTE_ERROR'],
    ['error', new Error('private-data'), 'AI_CONNECTION_FAILED'],
  ])(
    'settles %s failure and releases the session',
    async (event, value, code) => {
      const { service, sockets, input } = setup();
      const pending = service.streamAsk(input);
      const rejection = expect(pending).rejects.toMatchObject({ code });
      sockets[0].emit(
        event,
        typeof value === 'string' ? Buffer.from(value) : value,
      );
      await rejection;
      const next = service.streamAsk({ ...input, turnId: 'b' });
      service.stopGeneration(1, 'b');
      await expect(next).resolves.toBe('cancelled');
    },
  );

  it('rejects overlapping turns and ignores cancellation for another turn', async () => {
    const { service, sockets, input } = setup();
    const first = service.streamAsk(input);
    await expect(
      service.streamAsk({ ...input, turnId: 'b' }),
    ).rejects.toMatchObject({ code: 'CHAT_BUSY' });
    service.stopGeneration(1, 'b');
    expect(sockets[0].close).not.toHaveBeenCalled();
    service.stopGeneration(1, 'a');
    await expect(first).resolves.toBe('cancelled');
    const second = service.streamAsk({ ...input, turnId: 'b' });
    sockets[0].emit('close');
    service.stopGeneration(1, 'b');
    await expect(second).resolves.toBe('cancelled');
  });

  it('handles abort and shutdown without successful completion', async () => {
    const { service, input } = setup();
    const controller = new AbortController();
    const first = service.streamAsk({ ...input, signal: controller.signal });
    controller.abort();
    await expect(first).resolves.toBe('cancelled');
    const second = service.streamAsk(input);
    service.onModuleDestroy();
    await expect(second).resolves.toBe('cancelled');
  });

  it.each(['connect', 'idle', 'duration'])(
    'bounds %s waiting',
    async (kind) => {
      jest.useFakeTimers();
      try {
        const { service, sockets, input } = setup({
          AI_CONNECT_TIMEOUT_MS: kind === 'connect' ? 10 : 100,
          AI_IDLE_TIMEOUT_MS: kind === 'idle' ? 10 : 100,
          AI_MAX_DURATION_MS: kind === 'duration' ? 10 : 100,
        });
        const pending = service.streamAsk(input);
        const rejection = expect(pending).rejects.toMatchObject({
          code: 'AI_TIMEOUT',
        });
        if (kind !== 'connect') sockets[0].emit('open');
        await jest.advanceTimersByTimeAsync(11);
        await rejection;
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('fails immediately without configuration', async () => {
    const service = new AiService(new ConfigService({}));
    await expect(
      service.streamAsk({
        sessionId: 1,
        turnId: 'a',
        message: '',
        profile_json: {},
        test_json: {},
        history: [],
        onToken: () => {},
      }),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
  });
});
