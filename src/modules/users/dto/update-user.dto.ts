import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}
export class UpdateUserDto {
  @IsNotEmpty()
  @IsString()
  fullname: string;

  @IsNotEmpty()
  @IsString()
  phone: string;
  @IsOptional()
  @IsString()
  address?: string;
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'NAM') return Gender.MALE;
    if (value === 'NU') return Gender.FEMALE;
    if (value === 'KHAC') return Gender.OTHER;
    return value;
  })
  @IsEnum(Gender)
  gender?: Gender;
  @IsOptional()
  @IsNumber()
  class?: number;
}
