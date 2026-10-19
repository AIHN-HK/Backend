import { AuthService } from '../src/modules/auth/auth.service';
import { TokenService } from '../src/core/services/token.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpService } from '../src/modules/otp/otp.service';
import { OtpRepository } from '../src/modules/otp/otp.repository';
import { OtpType } from '../src/core/types/otp.type';

describe('auth secrets and revocation', () => {
  const user = {
    id: 1,
    email: 'test@example.test',
    password: 'hash',
    role: 'USER',
    fullname: 'Test',
  };
  let service: AuthService;
  let revoked = false;
  let cacheDeleted: string[];
  beforeEach(() => {
    revoked = false;
    cacheDeleted = [];
    service = new (AuthService as any)(
      {
        deleteRefreshToken: async () => {
          revoked = true;
        },
        resetPasswordWithOtp: async () => {
          revoked = true;
          return { id: 1, email: user.email };
        },
      },
      {
        findByEmail: async () => user,
        updatePassword: async () => ({ ...user }),
      },
      {},
      { get: () => '7d' },
      { hash: async () => 'hash' },
      {},
      {
        deleteExistingOtps: async () => {},
        createOtpCode: async () => '123456',
        checkVerifyOtp: async () => true,
      },
      { sendOtp: async () => {} },
      {
        del: async (key: string) => {
          cacheDeleted.push(key);
        },
      },
    );
  });
  it('never returns forgot-password OTP', async () => {
    expect(await service.sendForgotPasswordOtp(user.email)).toEqual({
      sent: true,
    });
  });
  it('reset does not return password and revokes refresh tokens', async () => {
    const result = await service.resetPassword({
      email: user.email,
      otp: '123456',
      newPassword: 'new-password',
    });
    expect(JSON.stringify(result)).not.toContain('hash');
    expect(revoked).toBe(true);
  });
  it('logout invalidates legacy AI context', async () => {
    await service.logout(1);
    expect(revoked).toBe(true);
    expect(cacheDeleted).toContain('user-context-1');
  });
  it('issues distinct refresh JWTs within one second', async () => {
    const tokens = new TokenService(new JwtService(), {
      get: (k: string) => (k.includes('SECRET') ? 'test-only' : '7d'),
    } as ConfigService);
    const a = await tokens.signRefreshToken({ userId: 1 });
    const b = await tokens.signRefreshToken({ userId: 1 });
    expect(a).not.toBe(b);
  });
});

describe('OTP validation and resend', () => {
  it('invalid/used/expired OTP is an HTTP 401', async () => {
    for (const row of [
      null,
      { used: true, expiresAt: new Date(Date.now() + 10000) },
      { used: false, expiresAt: new Date(0) },
    ]) {
      const service = new OtpService({ findFirst: async () => row } as any);
      await expect(
        service.verifyOtpCode({
          email: 'a@example.test',
          code: '123456',
          type: OtpType.REGISTER,
        }),
      ).rejects.toMatchObject({ status: 401 });
    }
  });
  it('repository stores OTP with the same 10-minute expiry as the email', async () => {
    let data: any;
    const repository = new OtpRepository({
      otp: {
        create: async (args: any) => {
          data = args.data;
          return data;
        },
      },
    } as any);
    const start = Date.now();
    await repository.createOtp({
      email: 'a@example.test',
      code: '123456',
      type: OtpType.REGISTER,
    });
    expect(data.expiresAt.getTime() - start).toBeGreaterThanOrEqual(599900);
    expect(data.expiresAt.getTime() - start).toBeLessThanOrEqual(600100);
  });
});
