import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { UniqueQuestionInAnswer } from 'src/core/decorators/UniqueQuestionInAnswer';
// import { UniqueQuestionInAnswer } from 'src/core/decorators/UniqueQuestionInAnswer';

export class AnswerDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  questionId: number;
  // @IsDefined()
  // @IsBoolean()
  // @Type(() => Boolean)
  // check: boolean;
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  answerValue: number;
}
export class SubmitAnswerDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  attemptId: number;
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayNotEmpty()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Validate(UniqueQuestionInAnswer)
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
export class AnswerDtoV2 {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  questionId: number;
  @IsDefined()
  @IsBoolean()
  check: boolean;
}
export class SubmitAnswerDtoV2 {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  attemptId: number;
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayNotEmpty()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Validate(UniqueQuestionInAnswer)
  @Type(() => AnswerDtoV2)
  answers: AnswerDtoV2[];
}
