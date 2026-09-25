import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
export enum QuestionType {
  R = 'R',
  I = 'I',
  A = 'A',
  S = 'S',
  E = 'E',
  C = 'C',
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(QuestionType)
  type: QuestionType;
}
