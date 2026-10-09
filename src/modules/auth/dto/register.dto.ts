import { Matches, MaxLength } from 'class-validator';
import {
  IsEmail,
  IsString,
  MinLength,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
  @IsNotEmpty()
  @IsString()
  fullname: string;
  @IsDateString()
  yob: string;
  @IsNotEmpty()
  @IsString()
  phone: string;
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/)
  otpCode: string;
}
