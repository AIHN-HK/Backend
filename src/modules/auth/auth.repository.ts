import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, OtpType } from '@prisma/client';
import { checkOtpProof, otpDigest } from '../otp';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async consumeOtp(
    tx: Prisma.TransactionClient,
    email: string,
    code: string,
    type: OtpType,
    id: number,
  ) {
    const result = await tx.otp.updateMany({
      where: {
        id,
        email,
        code: otpDigest(email, code, type),
        type,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });
    if (result.count !== 1)
      throw new UnauthorizedException('Invalid or expired OTP');
  }

  async registerWithOtp(data: Prisma.UserCreateInput, code: string) {
    const id = await checkOtpProof(
      this.prisma,
      data.email,
      code,
      OtpType.REGISTER,
    );
    return this.prisma.$transaction(async (tx) => {
      await this.consumeOtp(tx, data.email, code, OtpType.REGISTER, id);
      return tx.user.create({
        data: { ...data, role: 'USER' },
        select: { id: true, email: true, fullname: true },
      });
    });
  }

  async resetPasswordWithOtp(
    id: number,
    email: string,
    code: string,
    password: string,
  ) {
    const otpId = await checkOtpProof(
      this.prisma,
      email,
      code,
      OtpType.FORGOT_PASSWORD,
    );
    return this.prisma.$transaction(async (tx) => {
      await this.consumeOtp(tx, email, code, OtpType.FORGOT_PASSWORD, otpId);
      await tx.user.update({ where: { id }, data: { password } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      return { id, email };
    });
  }

  rotateRefreshToken(
    userId: number,
    oldToken: string,
    next: { token: string; expiresAt: Date },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshToken.deleteMany({
        where: { userId, token: oldToken, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException('Invalid refresh token');
      await tx.refreshToken.create({ data: { ...next, userId } });
    });
  }

  async createRefreshToken(data: {
    token: string;
    userId: number;
    expiresAt: Date;
  }) {
    return this.prisma.refreshToken.create({
      data,
    });
  }

  async findRefreshToken(token: string, userId: number) {
    return this.prisma.refreshToken.findUnique({
      where: { token, userId: userId },
      include: { user: true },
    });
  }

  async deleteRefreshToken(id: number) {
    return this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });
  }

  async deleteExpiredTokens() {
    return this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
  async findRefreshTokenbyId(userId: number) {
    return this.prisma.refreshToken.findFirst({
      where: { userId },
    });
  }
  async TransactionRefreshToken(
    userId: number,
    data: { token: string; expiresAt: Date },
  ) {
    return this.prisma.$transaction([
      // 1. Xoá tất cả token cũ của user này
      this.prisma.refreshToken.deleteMany({
        where: { userId },
      }),
      // 2. Tạo token mới
      this.prisma.refreshToken.create({
        data: {
          token: data.token,
          userId: userId,
          expiresAt: data.expiresAt,
        },
      }),
    ]);
  }
}
