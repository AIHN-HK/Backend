import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { ChatContextBuilder } from './chat-context.builder';

describe('chat persistence and checkpoint', () => {
  function setup(
    outcome: 'completed' | 'cancelled' | 'failed' = 'completed',
    failSave = false,
  ) {
    let rows: any[] = [
      { id: 1, sessionId: 9, role: 'user', content: 'previous', checkpoint: 0 },
    ];
    const client = (list: any[]) => ({
      chatMessage: {
        create: async ({ data }: any) => {
          if (failSave && data.role === 'assistant')
            throw new Error('DB write failed');
          const row = { ...data, id: list.length + 1, checkpoint: 0 };
          list.push(row);
          return row;
        },
        findMany: async () =>
          list.filter((row) => row.checkpoint === 0).map((row) => ({ ...row })),
        updateMany: async ({ where }: any) => {
          list
            .filter((row) => where.id.in.includes(row.id))
            .forEach((row) => (row.checkpoint = 1));
        },
      },
    });
    const prisma: any = {
      ...client(rows),
      chatSession: {
        findUnique: async () => ({ userId: 1, attemptId: 2 }),
        updateMany: async () => {},
      },
      result: { findUnique: async () => ({ attemptId: 2 }) },
      user: {
        findUnique: async () => ({
          fullname: 'Current',
          yob: new Date('2009-01-01'),
          address: 'Current address',
        }),
      },
      $transaction: async (callback: any) => {
        const next = structuredClone(rows);
        await callback(client(next));
        rows = next;
      },
    };
    const ai: any = {
      streamAsk: jest.fn(async (input) => {
        if (outcome === 'failed') throw new Error('AI failed');
        input.onToken('answer');
        rows.push({
          id: 99,
          sessionId: 9,
          role: 'user',
          content: 'arrived later',
          checkpoint: 0,
        });
        return outcome;
      }),
    };
    const repository = new ChatRepository(prisma);
    const service = new ChatService(
      repository,
      ai,
      new ChatContextBuilder(repository, {
        getResultRanking: async () => ({ attemptId: 2 }),
      } as any),
    );
    const end = jest.fn();
    const run = () =>
      service.handleUserMessageStream({
        sessionId: 9,
        content: 'new',
        onToken: () => {},
        onEnd: end,
        userId: 1,
        turnId: 'a',
      });
    return { run, rows: () => rows, ai, end, service };
  }

  it('saves assistant and acknowledges only the history sent to AI', async () => {
    const fixture = setup();
    await expect(fixture.run()).resolves.toBe('completed');
    expect(
      fixture.rows().filter((row) => row.role === 'assistant'),
    ).toHaveLength(1);
    expect(fixture.rows().find((row) => row.id === 1).checkpoint).toBe(1);
    expect(fixture.rows().find((row) => row.id === 99).checkpoint).toBe(0);
    expect(fixture.end).toHaveBeenCalledTimes(1);
  });
  it.each(['failed', 'cancelled'] as const)(
    'retains history when AI is %s',
    async (outcome) => {
      const fixture = setup(outcome);
      if (outcome === 'failed')
        await expect(fixture.run()).rejects.toThrow('AI failed');
      else await expect(fixture.run()).resolves.toBe('cancelled');
      expect(
        fixture.rows().filter((row) => row.role === 'assistant'),
      ).toHaveLength(0);
      expect(fixture.rows().every((row) => row.checkpoint === 0)).toBe(true);
      expect(fixture.end).not.toHaveBeenCalled();
    },
  );
  it('rolls back checkpoint and rejects if assistant persistence fails', async () => {
    const fixture = setup('completed', true);
    await expect(fixture.run()).rejects.toThrow('DB write failed');
    expect(fixture.rows().every((row) => row.checkpoint === 0)).toBe(true);
    expect(fixture.end).not.toHaveBeenCalled();
  });
  it('checks the queued owner before writing or contacting AI', async () => {
    const fixture = setup();
    await expect(
      fixture.service.handleUserMessageStream({
        sessionId: 9,
        content: 'private',
        userId: 8,
        turnId: 'a',
        onToken: () => {},
        onEnd: () => {},
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(fixture.rows()).toHaveLength(1);
    expect(fixture.ai.streamAsk).not.toHaveBeenCalled();
  });
});
