import {
  Matches,
  MinLength as PasswordMinLength,
  MaxLength,
  IsEmail as Email,
} from 'class-validator';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Email()
  email: string;
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  otp: string;
  @IsString()
  @IsNotEmpty()
  @PasswordMinLength(8)
  @MaxLength(72)
  newPassword: string;
}
