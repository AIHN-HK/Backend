import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubmitAnswerDto, SubmitAnswerDtoV2 } from './dto/create_answer.dto';
import { AnswerRepository } from './answer.repository';
import { QuestionRepository } from '../question/question.repository';
import { AttemptRepository } from '../attempt/attempt.repository';
import { ResultRepository } from '../result/result.repository';
import { ScoreCalculatorService } from 'src/core/services/score-calculator.services';
import { RiasecCode } from 'src/core/constants/riasec.type';

import { PriorityRepository } from '../priority/priority.repository';
import { RedisService } from 'src/core/redis/redis.service';
import { AnswerSubmitLockService } from './answer-submit-lock.service';

@Injectable()
export class AnswerService {
  constructor(
    private readonly answerRepository: AnswerRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly attemptRepository: AttemptRepository,
    private readonly resultRepository: ResultRepository,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly priorityRepository: PriorityRepository,
    private readonly redisService: RedisService,
    private readonly answerSubmitLockService: AnswerSubmitLockService,
  ) {}
  async findTopCode(
    scores: Record<RiasecCode, number>,
    numberoftype: number,
  ): Promise<string> {
    const priority = await this.redisService.getOrSet(
      'priority:all',
      3600,
      () => this.priorityRepository.getPriorities(),
    );
    const rank = priority.map((p) => ({
      type: p.type,
      score: scores[p.type] || 0,
      priority: p.priority,
    }));
    rank.sort((a, b) => {
      if (b.score === a.score) {
        return a.priority - b.priority;
      }
      return b.score - a.score;
    });
    return rank
      .slice(0, numberoftype)
      .map((r) => r.type)
      .join('');
  }
  async createAnswer(dto: SubmitAnswerDto, userId: number) {
    const { attemptId, answers } = dto;
    const belongsToUser = await this.attemptRepository.findByIdAndUser(
      attemptId,
      userId,
    );
    if (!belongsToUser) {
      throw new ForbiddenException('Access denied');
    }
    const question = answers.map((a) => a.questionId);
    const questions = await this.questionRepository.findQuestionsByIdsDetailed(
      answers.map((a) => a.questionId),
    );
    const existQuestion = questions.map((q) => q.id);
    const invalidQuestions = answers
      .map((a) => a.questionId)
      .filter((id) => !existQuestion.includes(id));
    if (invalidQuestions.length > 0) {
      throw new Error(`Invalid question IDs: ${invalidQuestions.join(', ')}`);
    }
    const questionSet = new Set(question);
    if (questionSet.size !== question.length) {
      throw new Error(`Duplicate question IDs found in answers.`);
    }
    const attempt = await this.attemptRepository.findById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt with ID ${attemptId} does not exist.`);
    }
    if (attempt.finishAt) {
      throw new Error(`Attempt with ID ${attemptId} is already completed.`);
    }
    if (
      attempt.totalQuestions > question.length ||
      attempt.totalQuestions < question.length
    ) {
      throw new Error(
        `Number of answers does not match the total questions for must complete for submit ${attemptId}.`,
      );
    } else if (attempt.totalQuestions === 0) {
      throw new Error(`Attempt with ID ${attemptId} has zero total questions.`);
    }
    // const checkedAnswers = answers.filter((a) => a.check === true);
    // if (checkedAnswers.length === 0) {
    //   throw new Error(`At least one answer must be checked true.`);
    // }
    await this.answerRepository.createAnswer(attemptId, answers);

    await this.answerRepository.findByAttemptId(attemptId);
    const attemptQuestion =
      await this.attemptRepository.FindAnswerwithQuestion(attemptId);
    const inputs = attemptQuestion.answers.map((ans) => ({
      type: ans.question.type as RiasecCode,
    }));
    const { score } = this.scoreCalculatorService.calculateScores(inputs);
    const topCode = await this.findTopCode(score, 3);
    await this.resultRepository.createResult({
      attemptId,
      scores: score,
      topCode: topCode,
    });
    await this.resultRepository.snapshot({
      attemptId,
      snapshot: {
        result: {
          scoreR: score.R,
          scoreI: score.I,
          scoreA: score.A,
          scoreS: score.S,
          scoreE: score.E,
          scoreC: score.C,
          topCode: topCode,
        },
        questions: attemptQuestion.answers.map((ans) => ({
          id: ans.question.id,
          content: ans.question.content,
          type: ans.question.type,
          answerValue: ans.answerValue,
          dimension: ans.question.dimension,
        })),
      },
    });
    await this.attemptRepository.markFinish(attemptId, {
      completedAt: new Date(),
    });
    return { attemptId, score, topCode };
  }
  async createAnswerV2(dto: SubmitAnswerDtoV2, userId: number) {
    return this.answerSubmitLockService.withAttemptLock(dto.attemptId, () =>
      this.createAnswerV2Core(dto, userId),
    );
  }

  private async createAnswerV2Core(dto: SubmitAnswerDtoV2, userId: number) {
    const { attemptId, answers } = dto;
    const belongsToUser = await this.attemptRepository.findByIdAndUser(
      attemptId,
      userId,
    );
    if (!belongsToUser) {
      throw new ForbiddenException('Access denied');
    }

    if (belongsToUser.finishAt) {
      throw new Error('Attempt already completed');
    }

    if (belongsToUser.totalQuestions !== answers.length) {
      throw new Error('Invalid answer length');
    } else if (belongsToUser.totalQuestions === 0) {
      throw new Error(`Attempt with ID ${attemptId} has zero total questions.`);
    }

    const questionIds = answers.map((a) => a.questionId);
    const questions =
      await this.questionRepository.findQuestionsByIdsDetailed(questionIds);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new Error('Duplicate question IDs found in answers.');
    }

    // check question tồn tại
    if (questions.length !== questionIds.length) {
      const existIds = new Set(questions.map((q) => q.id));

      const invalidQuestions = questionIds.filter((id) => !existIds.has(id));

      throw new Error(`Invalid question IDs: ${invalidQuestions.join(', ')}`);
    }

    if (!answers.some((a) => a.check)) {
      throw new Error('At least one answer must be checked');
    }
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Prepare inputs for score calculation and answers for DB
    const inputs = [];
    const dbAnswers = answers.map((a) => {
      const q = questionMap.get(a.questionId);
      if (a.check) {
        inputs.push({ type: q.type as RiasecCode });
      }
      return {
        attemptId,
        questionId: a.questionId,
        answerValue: a.check ? 1 : 0,
      };
    });

    const { score } = this.scoreCalculatorService.calculateScores(inputs);
    const topCode = await this.findTopCode(score, 3);

    // Call Repository Transaction
    await this.answerRepository.submitAnswerTransaction({
      attemptId,
      answers: dbAnswers,
      resultData: {
        attempt: { connect: { id: attemptId } },
        scoreR: score.R,
        scoreI: score.I,
        scoreA: score.A,
        scoreS: score.S,
        scoreE: score.E,
        scoreC: score.C,
        topCode: topCode,
      },
      completedAt: new Date(),
    });

    // Run snapshot asynchronously in the background
    const snapshotQuestions = answers.map((ans) => {
      const q = questionMap.get(ans.questionId);
      return {
        id: q.id,
        content: q.content,
        type: q.type,
        answerValue: ans.check ? 1 : 0,
        dimension: q.dimension,
      };
    });

    this.createSnapshotAsync(
      attemptId,
      score,
      topCode,
      snapshotQuestions,
    ).catch((e) => {
      console.error(`Failed to create snapshot for attempt ${attemptId}:`, e);
    });

    return { attemptId, score, topCode };
  }

  private async createSnapshotAsync(
    attemptId: number,
    score: any,
    topCode: string,
    questions: any[],
  ) {
    await this.resultRepository.snapshot({
      attemptId,
      snapshot: {
        result: {
          scoreR: score.R,
          scoreI: score.I,
          scoreA: score.A,
          scoreS: score.S,
          scoreE: score.E,
          scoreC: score.C,
          topCode: topCode,
        },
        questions,
      },
    });
  }
}
