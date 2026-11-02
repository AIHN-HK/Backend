import { Injectable } from '@nestjs/common';
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
    await this.otpRepository.verifyProof(data.email, data.code, data.type);
    return true;
  }
}
export function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}
