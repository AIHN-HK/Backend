import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SubmitAnswerDto, SubmitAnswerDtoV2 } from './dto/create_answer.dto';
import { AnswerRepository } from './answer.repository';
import { QuestionRepository } from '../question';
import { AttemptRepository } from '../attempt';
import { ScoreCalculatorService } from '../assessment';
import { RiasecCode } from '../assessment';
import { PriorityRepository } from '../priority';
import { AnswerSubmitLockService } from './answer-submit-lock.service';

@Injectable()
export class AnswerService {
  constructor(
    private readonly answerRepository: AnswerRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly attemptRepository: AttemptRepository,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly priorityRepository: PriorityRepository,
    private readonly answerSubmitLockService: AnswerSubmitLockService,
  ) {}

  async findTopCode(scores: Record<RiasecCode, number>, count: number) {
    const priorities = await this.priorityRepository.getPriorities();
    return priorities
      .map((p) => ({ ...p, score: scores[p.type] || 0 }))
      .sort((a, b) => b.score - a.score || a.priority - b.priority)
      .slice(0, count)
      .map((p) => p.type)
      .join('');
  }

  async createAnswer(dto: SubmitAnswerDto, userId: number) {
    if (dto.answers.some((answer) => ![0, 1].includes(answer.answerValue))) {
      throw new BadRequestException({
        code: 'BINARY_ANSWERS_REQUIRED',
        message: 'Use answerValue 0/1 or submit-v2 with boolean check.',
      });
    }
    return this.createAnswerV2(
      {
        attemptId: dto.attemptId,
        answers: dto.answers.map((answer) => ({
          questionId: answer.questionId,
          check: answer.answerValue === 1,
        })),
      },
      userId,
    );
  }

  async createAnswerV2(dto: SubmitAnswerDtoV2, userId: number) {
    return this.answerSubmitLockService.withAttemptLock(dto.attemptId, () =>
      this.submit(dto, userId),
    );
  }

  private async submit(dto: SubmitAnswerDtoV2, userId: number) {
    const attempt = await this.attemptRepository.findByIdAndUser(
      dto.attemptId,
      userId,
    );
    if (!attempt) throw new ForbiddenException('Access denied');
    if (attempt.finishAt) {
      throw new ConflictException({
        code: 'ATTEMPT_COMPLETED',
        message: 'Attempt already completed. Read its result before retrying.',
      });
    }
    if (
      !attempt.totalQuestions ||
      attempt.totalQuestions !== dto.answers.length
    ) {
      throw new BadRequestException('Invalid answer length');
    }
    const ids = dto.answers.map((answer) => answer.questionId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate question IDs');
    }
    if (dto.answers.some((answer) => typeof answer.check !== 'boolean')) {
      throw new BadRequestException('check must be a boolean');
    }
    const questions =
      await this.questionRepository.findQuestionsByIdsDetailed(ids);
    if (questions.length !== ids.length)
      throw new BadRequestException('Invalid question IDs');
    if (!dto.answers.some((answer) => answer.check)) {
      throw new BadRequestException('At least one answer must be checked');
    }
    const byId = new Map(questions.map((question) => [question.id, question]));
    const { score } = this.scoreCalculatorService.calculateScores(
      dto.answers
        .filter((answer) => answer.check)
        .map((answer) => ({
          type: byId.get(answer.questionId).type as RiasecCode,
        })),
    );
    const topCode = await this.findTopCode(score, 3);
    const result = {
      scoreR: score.R,
      scoreI: score.I,
      scoreA: score.A,
      scoreS: score.S,
      scoreE: score.E,
      scoreC: score.C,
      topCode,
    };
    const snapshotQuestions = dto.answers.map((answer) => ({
      ...byId.get(answer.questionId),
      answerValue: answer.check ? 1 : 0,
    }));
    await this.answerRepository.submitAnswerTransaction({
      attemptId: dto.attemptId,
      userId,
      answers: dto.answers.map((answer) => ({
        attemptId: dto.attemptId,
        questionId: answer.questionId,
        answerValue: answer.check ? 1 : 0,
      })),
      resultData: { ...result, attempt: { connect: { id: dto.attemptId } } },
      snapshot: {
        result,
        questions: snapshotQuestions,
      } as Prisma.InputJsonValue,
      completedAt: new Date(),
    });
    return { attemptId: dto.attemptId, score, topCode };
  }
}
