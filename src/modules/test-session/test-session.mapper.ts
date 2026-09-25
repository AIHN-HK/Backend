import { AnalyzeMeta } from 'src/core/constants/riasec.type';
import { AnalyzeDataDto, HistoryItemDto } from './dto/history-item.dto';
import { AttemptWithResultDto } from './dto/attempt-with-result.dto';

export function mapAttemptToHistoryItem(
  attempt: AttemptWithResultDto,
  meta: AnalyzeMeta,
  analyzeData: AnalyzeDataDto | null,
): HistoryItemDto {
  return {
    attemptId: attempt.id,
    finishAt: attempt.finishAt.toLocaleDateString('vi-VN'),
    analyzeType: meta.type,
    primaryAnalyze: analyzeData,
  };
}
