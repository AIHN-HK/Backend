import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { checkOtpProof, otpDigest } from './otp-proof';
import { OtpType } from 'src/core/types/otp.type';

@Injectable()
export class OtpRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async issueOtp(data: { email: string; code: string; type: OtpType }) {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const previous = await tx.otp.findFirst({
            where: { email: data.email, type: data.type },
            orderBy: { createdAt: 'desc' },
          });
          if (previous && Date.now() - previous.createdAt.getTime() < 60000) {
            throw new HttpException(
              'Wait 1 minute before requesting a new OTP',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
          await tx.otp.deleteMany({
            where: { email: data.email, type: data.type },
          });
          return tx.otp.create({
            data: {
              ...data,
              code: otpDigest(data.email, data.code, data.type),
              expiresAt: new Date(Date.now() + 600000),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error.code === 'P2034')
        throw new HttpException(
          'OTP request in progress; retry later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      throw error;
    }
  }
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
        code: otpDigest(data.email, data.code, data.type),
        type: data.type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
  }
  verifyProof(email: string, code: string, type: OtpType) {
    return checkOtpProof(this.prismaService, email, code, type);
  }
  async findFirst(email: string, code: string, type: OtpType) {
    return this.prismaService.otp.findFirst({
      where: { email, code: otpDigest(email, code, type), type },
    });
  }
  async updateOtp(id: number) {
    return this.prismaService.otp.update({
      where: { id: id },
      data: { used: true },
    });
  }
}
