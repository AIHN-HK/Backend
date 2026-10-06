import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNotEmpty,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class UpdateUserDto {
  @Transform(trim)
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  fullname: string;

  @Transform(trim)
  @IsNotEmpty()
  @IsString()
  @Matches(/^0\d{9}$/)
  phone: string;

  @Transform((input) => {
    const value = trim(input);
    return value === '' ? null : value;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'NAM') return Gender.MALE;
    if (value === 'NU') return Gender.FEMALE;
    if (value === 'KHAC') return Gender.OTHER;
    return value;
  })
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  class?: number | null;
}
