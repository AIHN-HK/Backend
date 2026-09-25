import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

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
