import { AuthRepository } from '../src/modules/auth/auth.repository';
import { OtpType } from '../src/core/types/otp.type';
import { OtpRepository } from '../src/modules/otp/otp.repository';

// Stateful transactional substitute verifies rollback and one-use semantics;
// the local PostgreSQL smoke separately exercises real Prisma transactions.
function database() {
  let state: any = {
    otp: [
      {
        id: 1,
        email: 'a@example.test',
        code: '123456',
        type: OtpType.REGISTER,
        used: false,
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(0),
      },
    ],
    users: [],
    tokens: [
      { token: 'old', userId: 1, expiresAt: new Date(Date.now() + 600000) },
    ],
  };
  let tail = Promise.resolve();
  const client = (s: any) => ({
    otp: {
      updateMany: async ({ where }: any) => {
        const rows = s.otp.filter(
          (o: any) =>
            o.email === where.email &&
            o.code === where.code &&
            o.type === where.type &&
            !o.used &&
            o.expiresAt > where.expiresAt.gt,
        );
        rows.forEach((o: any) => (o.used = true));
        return { count: rows.length };
      },
      findFirst: async ({ where }: any) =>
        s.otp
          .filter((o: any) => o.email === where.email && o.type === where.type)
          .at(-1),
      deleteMany: async () => {
        s.otp = [];
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        s.otp.push({ ...data, id: 2, createdAt: new Date(), used: false });
        return data;
      },
    },
    user: {
      create: async ({ data }: any) => {
        s.users.push({ ...data, id: 1 });
        return { ...data, id: 1 };
      },
      update: async ({ data }: any) => {
        s.users[0] = { ...s.users[0], ...data };
        return { id: 1, email: 'a@example.test' };
      },
    },
    refreshToken: {
      deleteMany: async ({ where }: any) => {
        const old = s.tokens.length;
        s.tokens = s.tokens.filter(
          (t: any) =>
            !(
              t.userId === where.userId &&
              (!where.token || t.token === where.token) &&
              (!where.expiresAt || t.expiresAt > where.expiresAt.gt)
            ),
        );
        return { count: old - s.tokens.length };
      },
      create: async ({ data }: any) => {
        s.tokens.push(data);
        return data;
      },
    },
  });
  const db: any = {
    $transaction: (fn: any) => {
      const run = tail.then(async () => {
        const next = structuredClone(state);
        const result = await fn(client(next));
        state = next;
        return result;
      });
      tail = run.then(
        () => {},
        () => {},
      );
      return run;
    },
  };
  return { db, state: () => state };
}

describe('atomic auth writes', () => {
  it('register consumes OTP; a concurrent duplicate cannot create a second user', async () => {
    const d = database();
    const r: any = new AuthRepository(d.db);
    const input = {
      email: 'a@example.test',
      password: 'hash',
      fullname: 'Test',
      yob: new Date('2009-01-01'),
    };
    const outcomes = await Promise.allSettled([
      r.registerWithOtp(input, '123456'),
      r.registerWithOtp(input, '123456'),
    ]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(d.state().users).toHaveLength(1);
    expect(d.state().otp[0].used).toBe(true);
  });
  it('reset consumes OTP and revokes refresh in the same transaction', async () => {
    const d = database();
    d.state().otp[0].type = OtpType.FORGOT_PASSWORD;
    d.state().users = [{ id: 1, password: 'old' }];
    const r: any = new AuthRepository(d.db);
    await r.resetPasswordWithOtp(1, 'a@example.test', '123456', 'new-hash');
    expect(d.state().users[0].password).toBe('new-hash');
    expect(d.state().tokens).toHaveLength(0);
    await expect(
      r.resetPasswordWithOtp(1, 'a@example.test', '123456', 'other'),
    ).rejects.toMatchObject({ status: 401 });
    expect(d.state().users[0].password).toBe('new-hash');
  });
  it('exact refresh token can be rotated once even with concurrent requests', async () => {
    const d = database();
    const r: any = new AuthRepository(d.db);
    const results = await Promise.allSettled([
      r.rotateRefreshToken(1, 'old', {
        token: 'next-a',
        expiresAt: new Date(Date.now() + 600000),
      }),
      r.rotateRefreshToken(1, 'old', {
        token: 'next-b',
        expiresAt: new Date(Date.now() + 600000),
      }),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(d.state().tokens).toHaveLength(1);
  });
  it('resend cannot delete the active OTP during cooldown', async () => {
    const d = database();
    d.state().otp[0].createdAt = new Date();
    const r: any = new OtpRepository(d.db);
    await expect(
      r.issueOtp({
        email: 'a@example.test',
        code: '654321',
        type: OtpType.REGISTER,
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(d.state().otp[0].code).toBe('123456');
  });
});
