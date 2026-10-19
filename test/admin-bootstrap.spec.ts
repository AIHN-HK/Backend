import * as bcrypt from 'bcrypt';
// Load through require so the RED failure is the missing command, not a TS diagnostic.
const load = () => require('../scripts/bootstrap-admin');
const env = {
  BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
  BOOTSTRAP_ADMIN_PASSWORD: 'test-only-password',
  BOOTSTRAP_ADMIN_FULLNAME: 'Administrator',
  BOOTSTRAP_ADMIN_YOB: '1990-01-01',
};
describe('explicit admin bootstrap', () => {
  it('creates ADMIN with a bcrypt hash and never returns credentials', async () => {
    let row: any;
    const prisma = {
      user: {
        findUnique: async () => row,
        create: async ({ data }: any) => {
          row = { id: 1, ...data };
          return row;
        },
      },
    };
    const result = await load().bootstrapAdmin(prisma, env);
    expect(row.role).toBe('ADMIN');
    expect(
      await bcrypt.compare(env.BOOTSTRAP_ADMIN_PASSWORD, row.password),
    ).toBe(true);
    expect(result).toEqual({ created: true, id: 1 });
    const before = row.password;
    expect(
      await load().bootstrapAdmin(prisma, {
        ...env,
        BOOTSTRAP_ADMIN_PASSWORD: 'different-password',
      }),
    ).toEqual({ created: false, id: 1 });
    expect(row.password).toBe(before);
  });
  it('refuses implicit promotion of an existing USER', async () => {
    await expect(
      load().bootstrapAdmin(
        { user: { findUnique: async () => ({ id: 1, role: 'USER' }) } },
        env,
      ),
    ).rejects.toThrow('already exists');
  });
  it.each([
    {},
    { ...env, BOOTSTRAP_ADMIN_PASSWORD: 'short' },
    { ...env, BOOTSTRAP_ADMIN_EMAIL: 'invalid' },
    { ...env, BOOTSTRAP_ADMIN_YOB: '1990-02-31' },
  ])('rejects invalid config before database access', async (input) => {
    let read = false;
    await expect(
      load().bootstrapAdmin(
        {
          user: {
            findUnique: async () => {
              read = true;
            },
          },
        },
        input,
      ),
    ).rejects.toThrow();
    expect(read).toBe(false);
  });
});
