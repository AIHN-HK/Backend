import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { RiasecType } from '../../../core/constants/riasec.type';
import { QuestionDimension } from 'src/core/constants/dimension';
export class QuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @IsEnum(RiasecType)
  type: string;
  @IsEnum(QuestionDimension)
  dimension: QuestionDimension;
}
export interface QuestionResponse {
  id: number;
  content: string;
  type: string;
  dimension: string;
}
export type GroupedQuestionResponse = Record<
  string,
  Record<string, QuestionResponse[]>
>;
