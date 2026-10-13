import { UsersService } from '../src/modules/users/users.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { ChatRepository } from '../src/modules/chat/chat.repository';
import { ChatContextBuilder } from '../src/modules/chat/chat-context.builder';
describe('profile and AI context', () => {
  it('profile commit invalidates legacy context without reintroducing profile cache', async () => {
    const deleted: string[] = [];
    const s = new (UsersService as any)(
      {
        update: async () => ({
          fullname: 'New',
          email: 'a@example.test',
          yob: new Date('2009-01-01'),
        }),
      },
      { del: async (key: string) => deleted.push(key) },
    );
    await s.update(1, { fullname: 'New', phone: '0901234567' });
    expect(deleted).toContain('user-context-1');
  });
  it('a new chat turn reads current owner and the specific attempt even if cache is poisoned', async () => {
    let sent: any;
    let fullname = 'Before';
    const database: any = {
      chatMessage: {
        create: async () => {},
        findMany: async () => [],
        updateMany: async () => {},
      },
      chatSession: {
        findUnique: async () => ({
          userId: 1,
          attemptId: 9,
          attempt: { userId: 1 },
        }),
        updateMany: async () => {},
      },
      result: { findUnique: async () => ({ attemptId: 9 }) },
      user: {
        findUnique: async () => ({
          fullname,
          address: 'New address',
          yob: new Date('2009-01-01'),
        }),
      },
      $transaction: async (fn: any) => fn(database),
    };
    const ai = {
      streamAsk: (payload: any) => {
        sent = payload;
        return Promise.resolve('completed');
      },
    };
    const s = new ChatService(
      new ChatRepository(database),
      ai as any,
      new ChatContextBuilder(new ChatRepository(database), {
        getResultRanking: async (id: number) => ({ attemptId: id }),
      } as any),
    );
    await s.handleUserMessageStream({
      sessionId: 10,
      userId: 1,
      turnId: 'a',
      content: 'first',
      onToken: () => {},
      onEnd: () => {},
    });
    expect(sent.profile_json.basic_info.full_name).toBe('Before');
    expect(sent.test_json.attemptId).toBe(9);
    fullname = 'After';
    await s.handleUserMessageStream({
      sessionId: 10,
      userId: 1,
      turnId: 'b',
      content: 'second',
      onToken: () => {},
      onEnd: () => {},
    });
    expect(sent.profile_json.basic_info.full_name).toBe('After');
  });
});
