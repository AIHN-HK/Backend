import { UnauthorizedException } from '@nestjs/common';
import { OtpType, PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

/** A database dump alone must not disclose the six-digit challenge. */
export function otpDigest(email: string, code: string, type: string): string {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('OTP hashing secret is not configured');
  return createHmac('sha256', secret)
    .update(JSON.stringify([email, type, code]))
    .digest('hex');
}

/** Increment outside the business transaction so rejected guesses stay counted. */
export async function checkOtpProof(
  prisma: Pick<PrismaClient, 'otp'>,
  email: string,
  code: string,
  type: OtpType,
): Promise<number> {
  const otp = await prisma.otp.findFirst({ where: { email, type } });
  if (!otp) throw new UnauthorizedException('Invalid or expired OTP');
  const claimed = await prisma.otp.updateMany({
    where: {
      id: otp.id,
      used: false,
      expiresAt: { gt: new Date() },
      failedAttempts: { lt: 5 },
    },
    data: { failedAttempts: { increment: 1 } },
  });
  if (claimed.count !== 1 || otp.code !== otpDigest(email, code, type))
    throw new UnauthorizedException('Invalid or expired OTP');
  return otp.id;
}
