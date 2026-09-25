import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  otp: string;
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
