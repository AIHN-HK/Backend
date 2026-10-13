import { ConflictException } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

describe('chat turn coordination at the gateway', () => {
  it('reports cancellation coordination failure without clearing an unknown lease', async () => {
    const fixture = setup();
    fixture.turns.cancel.mockRejectedValue(new Error('Redis offline'));
    await fixture.gateway.handleStop({ sessionId: 9 }, fixture.socket);
    expect(fixture.turns.release).not.toHaveBeenCalled();
    expect(fixture.socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'CHAT_QUEUE_UNAVAILABLE' }),
    );
  });
  it('releases an abandoned lease only after an explicit stop', async () => {
    const fixture = setup();
    fixture.queue.getJob.mockResolvedValue({ getState: async () => 'failed' });
    await fixture.gateway.handleStop({ sessionId: 9 }, fixture.socket);
    expect(fixture.turns.release).toHaveBeenCalledWith(9, 'a');
  });
  function setup() {
    const emit = jest.fn();
    const turns: any = {
      reserve: jest.fn(async () => 'a'),
      cancel: jest.fn(async () => 'a'),
      release: jest.fn(async () => {}),
    };
    const queue: any = {
      add: jest.fn(async () => {}),
      getJob: jest.fn(async () => null),
    };
    const chat: any = {
      saveUserMessage: jest.fn(),
      assertSessionOwner: async () => ({}),
      stopGeneration: jest.fn(async () => {}),
    };
    const gateway = new ChatGateway(
      chat,
      { findUser: async () => ({ id: 1 }) } as any,
      { verify: () => ({ userId: 1 }) } as any,
      queue,
      turns,
    );
    gateway.server = { to: () => ({ emit }) } as any;
    const socket: any = {
      handshake: { auth: { token: 'fixture' } },
      data: { user: { userId: 1 }, sessionId: 9 },
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };
    return { gateway, turns, queue, chat, socket, emit };
  }
  it('rejects a busy session without queueing another turn', async () => {
    const fixture = setup();
    fixture.turns.reserve.mockRejectedValue(new ConflictException());
    await fixture.gateway.handleAsk(
      { sessionId: 9, content: 'message' },
      fixture.socket,
    );
    expect(fixture.queue.add).not.toHaveBeenCalled();
    expect(fixture.socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'CHAT_BUSY' }),
    );
  });
  it.each([
    null,
    [],
    {},
    { sessionId: '9' },
    { sessionId: -1 },
    { sessionId: 9, content: false },
    { sessionId: 9, content: ' ' },
  ])('rejects malformed payload %p without side effects', async (payload) => {
    const fixture = setup();
    await fixture.gateway.handleAsk(payload, fixture.socket);
    await fixture.gateway.handleMessage(payload, fixture.socket);
    expect(fixture.turns.reserve).not.toHaveBeenCalled();
    expect(fixture.queue.add).not.toHaveBeenCalled();
    expect(fixture.chat.saveUserMessage).not.toHaveBeenCalled();
    expect(fixture.socket.emit).toHaveBeenCalled();
  });
  it.each([null, [], {}])(
    'rejects malformed stop/auth payload %p',
    async (payload) => {
      const fixture = setup();
      await fixture.gateway.handleStop(payload, fixture.socket);
      await fixture.gateway.handleRefreshAuth(payload, fixture.socket);
      expect(fixture.turns.cancel).not.toHaveBeenCalled();
      expect(fixture.chat.stopGeneration).not.toHaveBeenCalled();
      expect(fixture.socket.emit).toHaveBeenCalled();
    },
  );
  it('queues only server-owned identity and message fields', async () => {
    const fixture = setup();
    await fixture.gateway.handleAsk(
      {
        sessionId: 9,
        content: ' message ',
        userId: 999,
        profile_json: { injected: true },
      },
      fixture.socket,
    );
    expect(fixture.queue.add.mock.calls[0][1]).toEqual({
      sessionId: 9,
      content: ' message ',
      userId: 1,
      turnId: 'a',
    });
  });
  it('releases reservation after enqueue failure and never reports queue success', async () => {
    const fixture = setup();
    fixture.queue.add.mockRejectedValue(new Error('Queue failed'));
    await fixture.gateway.handleAsk(
      { sessionId: 9, content: 'message' },
      fixture.socket,
    );
    expect(fixture.turns.release).toHaveBeenCalledWith(9, 'a');
    expect(fixture.emit).not.toHaveBeenCalled();
  });
  it('ignores old turn completion instead of hiding new turn tokens', () => {
    const fixture = setup();
    (fixture.gateway as any).generatingMap.set(9, 'b');
    fixture.gateway.handleChatEnd({
      sessionId: 9,
      turnId: 'a',
      status: 'completed',
    });
    fixture.gateway.handleChatToken({
      sessionId: 9,
      turnId: 'b',
      token: 'current',
    });
    expect(fixture.emit).toHaveBeenCalledWith('answer_token', {
      sessionId: 9,
      turnId: 'b',
      content: 'current',
    });
  });
  it('keeps an active lease if a waiting job is claimed during cancellation', async () => {
    const fixture = setup();
    fixture.queue.getJob.mockResolvedValue({
      getState: async () => 'waiting',
      remove: async () => {
        throw new Error('Job already active');
      },
    });
    await fixture.gateway.handleStop({ sessionId: 9 }, fixture.socket);
    expect(fixture.turns.release).not.toHaveBeenCalled();
    expect(fixture.chat.stopGeneration).toHaveBeenCalledWith(9, 'a');
  });
  it.each(['', ' ', 'x'.repeat(8001)])(
    'rejects empty or oversized messages before reserving',
    async (content) => {
      const fixture = setup();
      await fixture.gateway.handleAsk(
        { sessionId: 9, content },
        fixture.socket,
      );
      expect(fixture.turns.reserve).not.toHaveBeenCalled();
    },
  );
});
