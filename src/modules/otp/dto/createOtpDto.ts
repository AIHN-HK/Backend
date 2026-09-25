import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { OtpType } from 'src/core/types/otp.type';

export class CreateOtpDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsEnum(OtpType)
  type: OtpType;
}
