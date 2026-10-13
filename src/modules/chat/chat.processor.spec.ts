import { Logger } from '@nestjs/common';
import { ChatProcessor } from './chat.processor';

describe('queue turn results', () => {
  it.each([undefined, null, false, 0])(
    'rejects a failed job even when thrown value is %p',
    async (failure) => {
      const log = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      try {
        const emit = jest.fn();
        const processor = new ChatProcessor(
          {
            handleUserMessageStream: async () => {
              throw failure;
            },
          } as any,
          { emit } as any,
          { isCurrent: async () => true, release: async () => {} } as any,
        );
        await expect(
          processor.handleAskJob({
            data: { sessionId: 9, userId: 1, turnId: 'a', content: 'fixture' },
          } as any),
        ).rejects.toThrow('CHAT_TURN_FAILED');
        expect(emit).toHaveBeenCalledWith(
          'chat.end',
          expect.objectContaining({
            status: 'failed',
            code: 'CHAT_TURN_FAILED',
          }),
        );
      } finally {
        log.mockRestore();
      }
    },
  );
  it('rejects malformed queued data before calling coordination or AI', async () => {
    const run = jest.fn();
    const isCurrent = jest.fn();
    const processor = new ChatProcessor(
      { handleUserMessageStream: run } as any,
      {} as any,
      { isCurrent } as any,
    );
    await expect(
      processor.handleAskJob({
        data: { sessionId: 9, content: 'fixture' },
      } as any),
    ).rejects.toThrow('INVALID_CHAT_JOB');
    expect(isCurrent).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
  it.each(['completed', 'cancelled', 'failed'])(
    'reports %s once and releases the turn',
    async (outcome) => {
      const log = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      try {
        const emit = jest.fn();
        const release = jest.fn(async () => {});
        const processor = new ChatProcessor(
          {
            handleUserMessageStream: async () => {
              if (outcome === 'failed') throw new Error('private');
              return outcome;
            },
          } as any,
          { emit } as any,
          { isCurrent: async () => true, release } as any,
        );
        const job: any = {
          data: { sessionId: 9, userId: 1, turnId: 'a', content: 'fixture' },
        };
        if (outcome === 'failed')
          await expect(processor.handleAskJob(job)).rejects.toThrow(
            'CHAT_TURN_FAILED',
          );
        else await processor.handleAskJob(job);
        expect(
          emit.mock.calls.filter(([event]) => event === 'chat.end'),
        ).toHaveLength(1);
        expect(emit).toHaveBeenCalledWith(
          'chat.end',
          expect.objectContaining({ status: outcome }),
        );
        expect(release).toHaveBeenCalledWith(9, 'a');
        expect(JSON.stringify(log.mock.calls)).not.toContain('private');
      } finally {
        log.mockRestore();
      }
    },
  );
  it('never calls AI for a cancelled or expired queued turn', async () => {
    const run = jest.fn();
    const processor = new ChatProcessor(
      { handleUserMessageStream: run } as any,
      { emit: () => {} } as any,
      { isCurrent: async () => false, release: async () => {} } as any,
    );
    await processor.handleAskJob({
      data: { sessionId: 9, userId: 1, turnId: 'a', content: 'fixture' },
    } as any);
    expect(run).not.toHaveBeenCalled();
  });
});
