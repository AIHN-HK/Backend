import { ChatContextBuilder } from './chat-context.builder';

describe('bounded pending AI context', () => {
  it.each([201, 100001])(
    'rejects pending history exceeding limit %i without silently truncating',
    async (limit) => {
      const rows =
        limit === 201
          ? Array.from({ length: limit }, (_, id) => ({
              id,
              role: 'user' as const,
              content: 'message',
            }))
          : [{ id: 1, role: 'user' as const, content: 'x'.repeat(limit) }];
      const builder = new ChatContextBuilder(
        {
          pendingHistory: async () => rows,
          readContextRecords: async () => {
            throw new Error('unused');
          },
        },
        {} as never,
      );
      await expect(builder.pendingHistory(9)).rejects.toThrow(
        'Pending chat history exceeded its limit',
      );
    },
  );
  it('keeps boundary-sized pending history and its IDs', async () => {
    const rows = Array.from({ length: 200 }, (_, id) => ({
      id,
      role: 'user' as const,
      content: 'x'.repeat(500),
    }));
    const builder = new ChatContextBuilder(
      {
        pendingHistory: async () => rows,
        readContextRecords: async () => {
          throw new Error('unused');
        },
      },
      {} as never,
    );
    expect(await builder.pendingHistory(9)).toEqual(rows);
  });
});
