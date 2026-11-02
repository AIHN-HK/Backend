import { Injectable } from '@nestjs/common';
import { SessionRepository } from './test-session.repository';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttemptRepository } from '../attempt';
import { TopcodeRepository } from '../topcode';
import { RiasecScore } from '../assessment';
import { analyzeRiasec } from '../assessment';
import { ResultRepository } from '../result';
import { mapAttemptToHistoryItem } from './test-session.mapper';
import { AnalyzeDataDto, HistoryItemDto } from './dto/history-item.dto';
import { AttemptWithResultDto } from './dto/attempt-with-result.dto';
import { HistoryResponseDto } from './dto/history-response.dto';
@Injectable()
export class TestSessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly attemptRepository: AttemptRepository,
    private readonly topcodeRepository: TopcodeRepository,
    private readonly resultRepository: ResultRepository,
  ) {}

  async createSession(id: number) {
    return this.sessionRepository.create(id);
  }

  async deleteSession(id: number) {
    try {
      await this.sessionRepository.remove(id);
      return { message: `Session ${id} deleted successfully` };
    } catch (error) {
      if (error.code === 'P2025')
        throw new NotFoundException(`Session with id ${id} not found`);
      throw error;
    }
  }
  async getHistoryUser(
    userId: number,
    limit: number,
    cursorCreatedAt?: string,
    cursorId?: number,
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('limit must be between 1 and 50.');
    }
    if ((cursorCreatedAt !== undefined) !== (cursorId !== undefined)) {
      throw new BadRequestException('Both cursor fields must be provided.');
    }
    if (
      cursorId !== undefined &&
      (!Number.isSafeInteger(cursorId) ||
        cursorId < 1 ||
        Number.isNaN(new Date(cursorCreatedAt).getTime()))
    ) {
      throw new BadRequestException('Invalid cursor.');
    }
    const fetchData = async () => {
      const history: AttemptWithResultDto[] =
        await this.attemptRepository.getAttemptHistory(
          userId,
          limit,
          cursorCreatedAt ? new Date(cursorCreatedAt) : undefined,
          cursorId,
        );

      const hasNext = history.length > limit;
      const items = hasNext ? history.slice(0, limit) : history;
      const itemMetas = items
        .filter((h) => h.result !== null)
        .map((h) => {
          const scores: RiasecScore = {
            R: h.result.scoreR,
            I: h.result.scoreI,
            A: h.result.scoreA,
            S: h.result.scoreS,
            E: h.result.scoreE,
            C: h.result.scoreC,
          };
          return { h, meta: analyzeRiasec(h.result.topCode, scores), scores };
        });
      const hollandConditions = new Set<string>();
      const normalCodes = new Set<string>();
      for (const { meta } of itemMetas) {
        if (
          meta.type === 'ALL_HIGH' ||
          meta.type === 'ALL_LOW' ||
          meta.type === 'OPPOSITE'
        ) {
          hollandConditions.add(meta.condition);
        } else if (meta.type === 'NORMAL') {
          normalCodes.add(meta.codes[0]);
        }
      }
      // Bước 3: Chỉ 2 DB calls tổng cộng (hoặc ít hơn nếu không có loại đó)
      const [hollandResults, normalResults] = await Promise.all([
        hollandConditions.size > 0
          ? this.topcodeRepository.findHollandByConditions([
              ...hollandConditions,
            ])
          : Promise.resolve([]),
        normalCodes.size > 0
          ? this.resultRepository.findAnalyzeCodes([...normalCodes])
          : Promise.resolve([]),
      ]);
      // Bước 4: Tạo Map để lookup O(1)
      const hollandMap = new Map(hollandResults.map((r) => [r.condition, r]));
      const normalMap = new Map(normalResults.map((r) => [r.code, r]));
      // Bước 5: Map kết quả, không còn DB call nữa
      const formattedHistory = itemMetas
        .map(({ h, meta }) => {
          let analyzeData: AnalyzeDataDto | null = null;
          if (
            meta.type === 'ALL_HIGH' ||
            meta.type === 'ALL_LOW' ||
            meta.type === 'OPPOSITE'
          ) {
            analyzeData = hollandMap.get(meta.condition) ?? null;
          } else if (meta.type === 'NORMAL') {
            analyzeData = normalMap.get(meta.codes[0]) ?? null;
          }
          return mapAttemptToHistoryItem(h, meta, analyzeData);
        })
        .filter((i): i is HistoryItemDto => i !== null);
      const lastItem = items[items.length - 1];
      return {
        formattedHistory,
        pageInfo: {
          hasNext,
          nextCursor: hasNext
            ? {
                cursorCreatedAt: lastItem.createdAt.toISOString(),
                cursorId: lastItem.id,
              }
            : null,
        },
      } as HistoryResponseDto;
    };

    // Bounded authoritative reads avoid stale cache fills after completion.
    return fetchData();
  }
}
