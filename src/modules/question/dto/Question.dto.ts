import { IsString } from 'class-validator';
import { QuestionDimension } from 'src/core/constants/dimension';
export class QuestionDto {
  @IsString()
  content: string;

  @IsString()
  type: string;
  @IsString()
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
