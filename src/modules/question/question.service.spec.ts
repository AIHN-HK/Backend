import { QuestionService } from './question.service';

describe('question writes after cache failure', () => {
  it('returns a committed update even if legacy cache cleanup fails', async () => {
    const row = { id: 1, content: 'Current', type: 'R', dimension: 'PERSONA' };
    const repository: any = {
      findByid: async () => row,
      update: jest.fn(async () => row),
    };
    const service = new QuestionService(repository, {
      del: async () => {
        throw new Error('Redis unavailable');
      },
    } as any);
    await expect(
      service.updateQuestion(1, row as any, 9),
    ).resolves.toMatchObject({ id: 1, content: 'Current' });
    expect(repository.update).toHaveBeenCalledWith(1, row, 9);
  });
});
