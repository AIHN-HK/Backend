import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class CareerQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['R', 'I', 'A', 'S', 'E', 'C']) code?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 12;
}
export class CareerRating {
  @IsString() @MaxLength(30) skillId: string;
  @IsNumber() @Min(0) @Max(5) level: number;
}
export class InterestVector {
  @IsNumber() @Min(0) @Max(5) R: number;
  @IsNumber() @Min(0) @Max(5) I: number;
  @IsNumber() @Min(0) @Max(5) A: number;
  @IsNumber() @Min(0) @Max(5) S: number;
  @IsNumber() @Min(0) @Max(5) E: number;
  @IsNumber() @Min(0) @Max(5) C: number;
}
export class CareerProfileInput {
  @IsInt() @Min(0) revision: number;
  @IsArray()
  @ArrayMaxSize(35)
  @ValidateNested({ each: true })
  @Type(() => CareerRating)
  skills: CareerRating[];
  @IsOptional()
  @ValidateNested()
  @Type(() => InterestVector)
  interests?: InterestVector | null;
  @IsOptional() @IsString() @Matches(/^\d{2}-\d{4}\.\d{2}$/) targetCareerId?:
    | string
    | null;
}
export class CreateRecommendationInput {
  @IsInt() @Min(1) attemptId: number;
}
export class PublishCareerInput {
  @IsInt() @Min(1) revision: number;
  @IsBoolean() active: boolean;
}
export class CreateGoalInput {
  @IsString() @Matches(/^\d{2}-\d{4}\.\d{2}$/) careerId: string;
}
export class UpdateGoalTaskInput {
  @IsInt() @Min(1) revision: number;
  @IsBoolean() done: boolean;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  evidence: string;
}

export class GoalRevisionInput {
  @IsInt() @Min(1) revision: number;
}
