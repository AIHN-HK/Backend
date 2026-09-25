import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { OtpType } from 'src/core/types/otp.type';

@Injectable()
export class OtpRepository {
  constructor(private readonly prismaService: PrismaService) {}
  async lastOtpByEmail(email: string, type: OtpType) {
    return this.prismaService.otp.findFirst({
      where: { email, type },
      orderBy: { createdAt: 'desc' },
    });
  }
  async deleteManyByEmailAndType(email: string, type: OtpType) {
    return this.prismaService.otp.deleteMany({
      where: { email, type },
    });
  }
  async createOtp(data: { email: string; code: string; type: OtpType }) {
    return this.prismaService.otp.create({
      data: {
        email: data.email,
        code: data.code,
        type: data.type,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  }
  async findFirst(email: string, code: string, type: OtpType) {
    return this.prismaService.otp.findFirst({
      where: { email, code, type },
    });
  }
  async updateOtp(id: number) {
    return this.prismaService.otp.update({
      where: { id: id },
      data: { used: true },
    });
  }
}
