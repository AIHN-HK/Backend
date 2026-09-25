import { PageInfoDto } from './cursor-pagination.dto';
import { HistoryItemDto } from './history-item.dto';

export class HistoryResponseDto {
  formattedHistory!: HistoryItemDto[];
  pageInfo!: PageInfoDto;
}
