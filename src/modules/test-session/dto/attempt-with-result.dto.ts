export class ResultScoreDto {
  scoreR!: number;
  scoreI!: number;
  scoreA!: number;
  scoreS!: number;
  scoreE!: number;
  scoreC!: number;
  topCode!: string;
}

export class AttemptWithResultDto {
  id!: number;
  finishAt!: Date;
  createdAt!: Date;
  result!: ResultScoreDto | null;
}
