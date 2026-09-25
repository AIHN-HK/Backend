import { IsEnum, IsInt, IsString } from 'class-validator';
import { Gender } from './update-user.dto';

export class UserProfileResponseDto {
  @IsString()
  fullname: string;
  @IsString()
  phone?: string;
  @IsInt()
  age?: number;
  @IsString()
  address?: string;
  @IsEnum(Gender)
  gender?: Gender;
  @IsString()
  email: string;
  @IsInt()
  class?: number;
}
