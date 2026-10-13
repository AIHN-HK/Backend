import { Injectable, NotFoundException } from '@nestjs/common';
import { AttemptRepository } from '../attempt/attempt.repository';
import { ScoreCalculatorService } from 'src/core/services/score-calculator.services';
// import { RiasecCode } from 'src/core/constants/riasec.type';
import { ResultRepository } from './result.repository';
import { rankScores, ScoreItem } from 'src/core/services/rank_score';
import { RiasecScore } from 'src/core/constants/riasec.type';
import { RedisService } from 'src/core/redis/redis.service';
@Injectable()
export class ResultService {
  constructor(
    private readonly attemptRepository: AttemptRepository,
    private readonly resultRepository: ResultRepository,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly redisService: RedisService,
  ) {}
  // async createResult(attemptId: number) {
  //   const attempt = await this.attemptRepository.findById(attemptId);
  //   if (!attempt) {
  //     throw new Error(`Attempt with ID ${attemptId} does not exist.`);
  //   }
  //   if (attempt.finishAt) {
  //     throw new Error(`Attempt with ID ${attemptId} is already completed.`);
  //   }
  //   const attemptAnswersCount =
  //     await this.attemptRepository.countAnswers(attemptId);
  //   if (attemptAnswersCount === 0) {
  //     throw new Error(
  //       `Attempt with ID ${attemptId} has no answers to calculate result.`,
  //     );
  //   }

  //   const attemptQuestion =
  //     await this.attemptRepository.FindAnswerwithQuestion(attemptId);
  //   const inputs = attemptQuestion.answers.map((ans) => ({
  //     type: ans.question.type as RiasecCode,
  //     answerValue: ans.answerValue,
  //   }));
  //   const { score, topCode } = this.scoreCalculatorService.calculateScores(
  //     inputs,
  //     3,
  //   );
  //   await this.resultRepository.createResult({
  //     attemptId,
  //     scores: score,
  //     topCode,
  //   });
  //   await this.attemptRepository.markFinish(attemptId, {
  //     completedAt: new Date(),
  //   });
  //   return { attemptId, score, topCode };
  // }

  async getAnalyzeResultsByAttemptId(attemptId: number, userId: number) {
    const [result, belongsToUser] = await Promise.all([
      this.resultRepository.findByAttemptId(attemptId),
      this.attemptRepository.findByIdAndUser(attemptId, userId),
    ]);
    if (!belongsToUser) {
      throw new NotFoundException(
        `Attempt with ID ${attemptId} does not belong to the user.`,
      );
    }
    if (!result) {
      throw new NotFoundException(
        `Result for Attempt ID ${attemptId} does not exist.`,
      );
    }
    const topCode = result.topCode;
    const score = this.buildScores(result);
    const scores = score.reduce((acc, cur) => {
      acc[cur.type] = Number(cur.score) || 0;
      return acc;
    }, {} as RiasecScore);

    const analyzeResult = await this.resultRepository.findAnalyzeResult(
      topCode,
      scores,
    );
    if (!analyzeResult) {
      throw new Error(`Analyze results not found for the top code`);
    }
    return {
      analyzeResult,
      finishAt: result.attempt.finishAt.toLocaleDateString('vi-VN'),
    };
  }
  async Getsnapshot(attemptId: number, userId: number) {
    const owner = await this.attemptRepository.findByIdAndUser(
      attemptId,
      userId,
    );
    if (!owner)
      throw new NotFoundException('Attempt does not belong to the user.');
    // const [belongsToUser, snapshot] = await Promise.all([
    //   this.attemptRepository.findByIdAndUser(attemptId, userId),
    //   this.resultRepository.getSnapshotByAttemptId(attemptId),
    // ]);
    return this.redisService.getOrSet(
      `snapshot:${userId}:${attemptId}`,
      604800,
      async () => {
        return this.resultRepository.getSnapshotByAttemptId(attemptId);
      },
    );
  }
  async getResultRanking(attemptId: number, userId: number) {
    const [result, belongsToUser] = await Promise.all([
      this.resultRepository.findByAttemptId(attemptId),
      this.attemptRepository.findByIdAndUser(attemptId, userId),
    ]);
    if (!result) {
      throw new NotFoundException(
        'Result not found Or this Attempt unfinished yet',
      );
    }
    if (!belongsToUser) {
      throw new NotFoundException(
        `Attempt with ID ${attemptId} does not belong to the user.`,
      );
    }

    const score = this.buildScores(result);
    const ranked = rankScores(score);
    const top3 = ranked.slice(0, 3).map((i) => i.type);
    const scores = score.reduce((acc, cur) => {
      acc[cur.type] = cur.score;
      return acc;
    }, {} as RiasecScore);
    return {
      attemptId,
      ranked,
      scores,
      top3,
      top_code: result.topCode,
    };
  }
  async getAnalyzeResultsByTopCode(topCode: string) {
    return this.redisService.getOrSet(
      `topcode:${topCode}`,
      86400, // 24 giờ
      async () => {
        const result = await this.resultRepository.findAnalyzeCode(topCode);
        if (!result)
          throw new NotFoundException(
            'Analyze results not found for the top code',
          );
        return result;
      },
    );
  }

  private async getResultOrThrow(attemptId: number) {
    const result = await this.resultRepository.findByAttemptId(attemptId);

    if (!result) {
      throw new NotFoundException(
        'Result not found Or this Attempt unfinished yet',
      );
    }

    return result;
  }

  private buildScores(result: any): ScoreItem[] {
    return [
      { type: 'R', score: result.scoreR },
      { type: 'I', score: result.scoreI },
      { type: 'A', score: result.scoreA },
      { type: 'S', score: result.scoreS },
      { type: 'E', score: result.scoreE },
      { type: 'C', score: result.scoreC },
    ];
  }
}
