import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { RiasecType } from '../../assessment';

export class UpdateTopcodeBodyDto {
  @IsEnum(RiasecType)
  @IsNotEmpty()
  code: RiasecType;
  @IsString()
  @IsNotEmpty()
  title: string;
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  personality?: string[];
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  strengths: string[];
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  weaknesses: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  careers: string[];
}
