import { ResultService } from './result.service';

it('checks current attempt ownership before serving a cached snapshot', async () => {
  const cached = jest.fn(async () => ({ private: true }));
  const service = new ResultService(
    { findByIdAndUser: async () => null } as any,
    {} as any,
    {} as any,
    { getOrSet: cached } as any,
  );
  await expect(service.Getsnapshot(9, 1)).rejects.toMatchObject({
    status: 404,
  });
  expect(cached).not.toHaveBeenCalled();
});
