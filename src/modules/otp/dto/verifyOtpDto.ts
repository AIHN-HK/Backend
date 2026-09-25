import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OtpType } from 'src/core/types/otp.type';

export class verifyOtpCode {
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsString()
  code: string;
  @IsNotEmpty()
  @IsEnum(OtpType)
  type: OtpType;
}
