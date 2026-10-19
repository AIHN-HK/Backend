import { TestSessionService } from './test-session.service';

describe('authoritative history pagination', () => {
  const read = jest.fn(async () => []);
  const service = new TestSessionService(
    {} as any,
    { getAttemptHistory: read } as any,
    {} as any,
    {} as any,
  );
  beforeEach(() => read.mockClear());

  it('fetches each page size independently and sees a later submission', async () => {
    await service.getHistoryUser(9, 1);
    await service.getHistoryUser(9, 20);
    await service.getHistoryUser(9, 1);
    expect(read.mock.calls.map((call: any) => call.slice(0, 2))).toEqual([
      [9, 1],
      [9, 20],
      [9, 1],
    ]);
  });
  it.each([0, -1, 51, 1.5, Infinity])(
    'rejects invalid limit %p before reading DB',
    async (limit) => {
      await expect(service.getHistoryUser(9, limit)).rejects.toMatchObject({
        status: 400,
      });
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['2026-10-13T12:00:00.000Z', undefined],
    [undefined, 1],
    ['not-a-date', 1],
    ['2026-10-13T12:00:00.000Z', -1],
  ])('rejects incomplete/invalid cursor %p %p', async (date, id) => {
    await expect(service.getHistoryUser(9, 10, date, id)).rejects.toMatchObject(
      { status: 400 },
    );
    expect(read).not.toHaveBeenCalled();
  });
});
