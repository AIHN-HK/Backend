import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { CreateOtpDto } from './dto/createOtpDto';
import { verifyOtpCode } from './dto/verifyOtpDto';
import { OtpRepository } from './otp.repository';
import { OtpType } from 'src/core/types/otp.type';

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}
  async deleteExistingOtps(email: string, type: OtpType) {
    return this.otpRepository.deleteManyByEmailAndType(email, type);
  }
  async createOtpCode(data: CreateOtpDto) {
    const otpCode = generateOTP();
    await this.otpRepository.issueOtp({
      email: data.email,
      code: otpCode,
      type: data.type,
    });
    return otpCode;
  }
  async verifyOtpCode(data: verifyOtpCode) {
    const otp = await this.otpRepository.findFirst(
      data.email,
      data.code,
      data.type,
    );
    if (!otp) {
      throw new UnauthorizedException('Invalid OTP code');
    }
    if (otp.used) {
      throw new UnauthorizedException('OTP code has already been used');
    }
    if (new Date(otp.expiresAt) <= new Date()) {
      throw new UnauthorizedException('OTP code has expired');
    }

    return true;
  }
}
export function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}
