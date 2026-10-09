import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

const makeUser = (id: number) => ({
  id,
  fullname: `Student ${id}`,
  email: `${id}@example.test`,
  password: 'secret',
  role: 'USER',
  yob: new Date('2009-01-01'),
  phone: '0901234567',
  address: null,
  gender: null,
  class: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('personal profiles', () => {
  let users: Map<number, ReturnType<typeof makeUser>>;
  let service: UsersService;
  beforeEach(() => {
    users = new Map([
      [1, makeUser(1)],
      [2, makeUser(2)],
    ]);
    const repository = {
      findById: async (id: number) => users.get(id) ?? null,
      update: async (id: number, data: object) => {
        if (!users.has(id)) throw { code: 'P2025' };
        const updated = { ...users.get(id)!, ...data };
        users.set(id, updated);
        return updated;
      },
    } as unknown as UsersRepository;
    // Poisoned cache must never override authoritative profile data.
    const staleCache = {
      del: async () => {
        throw new Error('Redis offline');
      },
      getOrSet: async () => makeUser(2),
      setEx: async () => {
        throw new Error('Redis offline');
      },
    };
    service = new (UsersService as any)(repository, staleCache);
  });
  it('reads the requested user, with nullable fields and no sensitive data', async () => {
    const result = await service.findById(1);
    expect(result.fullname).toBe('Student 1');
    expect(result.gender).toBeNull();
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('id');
  });
  it('PATCH followed by GET reads new DB data despite stale/offline Redis', async () => {
    const result = await service.update(1, {
      fullname: 'Updated',
      phone: '0901234567',
    });
    expect(result.fullname).toBe('Updated');
    expect((await service.findById(1)).fullname).toBe('Updated');
    expect((await service.findById(2)).fullname).toBe('Student 2');
  });
  it('rejects missing users on read and update', async () => {
    await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    await expect(
      service.update(99, { fullname: 'A', phone: '0901234567' }),
    ).rejects.toThrow(NotFoundException);
  });
});
