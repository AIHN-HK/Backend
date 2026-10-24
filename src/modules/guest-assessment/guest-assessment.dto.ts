import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class GuestAnswerDto {
  @IsInt()
  @Min(1)
  questionId: number;

  @IsBoolean()
  check: boolean;
}
export class GuestPreviewDto {
  @IsString()
  @MaxLength(75000)
  catalogToken: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => GuestAnswerDto)
  answers: GuestAnswerDto[];
}
export class GuestClaimDto {
  @IsString()
  @MaxLength(75000)
  receipt: string;
}
