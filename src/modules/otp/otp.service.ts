import { Injectable } from '@nestjs/common';
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
    const lastOtp = await this.otpRepository.lastOtpByEmail(
      data.email,
      data.type,
    );
    if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < 60000) {
      throw new Error('Wait 1 minute before requesting a new OTP');
    }
    const otpCode = generateOTP();
    await this.otpRepository.createOtp({
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
      throw new Error('Invalid OTP code');
    }
    if (otp.used) {
      throw new Error('OTP code has already been used');
    }
    if (new Date(otp.expiresAt) < new Date()) {
      throw new Error('OTP code has expired');
    }

    return true;
  }
  async checkVerifyOtp(data: verifyOtpCode) {
    const otp = await this.otpRepository.findFirst(
      data.email,
      data.code,
      data.type,
    );
    if (!otp) {
      return false;
    }
    if (otp.used) {
      return false;
    }
    if (new Date(otp.expiresAt) < new Date()) {
      return false;
    }
    await this.otpRepository.updateOtp(otp.id);
    return true;
  }
}
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
