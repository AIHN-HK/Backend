import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { RiasecScore, RiasecType } from 'src/core/constants/riasec.type';

export class CreateResultDto {
  @IsNumber()
  attemptId: number;
  scores: RiasecScore;
  @IsString()
  topCode: string; // ví dụ: "RIA"
}
export class createResultInput {
  @IsNumber()
  @Type(() => Number)
  attemptId: number;
}
export interface QuestionSnapshot {
  id: number;
  content: string;
  type: string;
  answerValue: number;
}

export interface ResultSnapshot {
  scoreR: number;
  scoreI: number;
  scoreA: number;
  scoreS: number;
  scoreE: number;
  scoreC: number;
  topCode: string;
}
export class TopCodeDto {
  @IsEnum(RiasecType, {
    message: 'code phải là một trong các giá trị: R, I, A, S, E, C',
  })
  code: RiasecType;
}
export interface SnapshotData {
  questions: QuestionSnapshot[];
  result: ResultSnapshot;
}
export class CreateSnapshotDto {
  @IsInt()
  attemptId: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object) // class-transformer vẫn cần để validate object
  snapshot: SnapshotData;
}
