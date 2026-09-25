export type AnalyzeType = 'ALL_HIGH' | 'ALL_LOW' | 'OPPOSITE' | 'NORMAL';

export class AnalyzeDataDto {
  code!: string;
  title!: string;
  description?: string | null;
}

export class HistoryItemDto {
  attemptId!: number;
  finishAt!: string;
  analyzeType!: AnalyzeType;
  primaryAnalyze!: AnalyzeDataDto | null;
}
