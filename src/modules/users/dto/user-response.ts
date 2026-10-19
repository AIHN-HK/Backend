import { IsEnum, IsInt, IsString } from 'class-validator';
import { Gender } from './update-user.dto';

export class UserProfileResponseDto {
  @IsString()
  fullname: string;
  @IsString()
  phone: string | null;
  @IsInt()
  age?: number;
  @IsString()
  address: string | null;
  @IsEnum(Gender)
  gender: Gender | null;
  @IsString()
  email: string;
  @IsInt()
  class: number | null;
}
