import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateQuestionDto } from './create-question.dto';

export class BulkCreateQuestionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}
