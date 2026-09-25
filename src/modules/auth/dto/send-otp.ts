// send-otp.dto.ts
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  otp: string;
}
