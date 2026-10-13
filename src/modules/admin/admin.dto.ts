import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RiasecType } from '../assessment';

export class AdminPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}
export class PriorityItemDto {
  @IsEnum(RiasecType) type: RiasecType;
  @IsInt() @Min(1) @Max(6) priority: number;
}
export class AdminPrioritiesDto {
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => PriorityItemDto)
  priorities: PriorityItemDto[];
}
