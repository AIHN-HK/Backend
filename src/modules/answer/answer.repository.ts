import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { AnswerDto, AnswerDtoV2 } from './dto/create_answer.dto';

@Injectable()
export class AnswerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async submitAnswerTransaction(data: {
    attemptId: number;
    userId: number;
    answers: Prisma.AnswerCreateManyInput[];
    resultData: Prisma.ResultCreateInput;
    completedAt: Date;
    snapshot: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.attempt.updateMany({
        where: { id: data.attemptId, userId: data.userId, finishAt: null },
        data: { finishAt: data.completedAt },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: 'ATTEMPT_COMPLETED',
          message: 'Attempt already completed or no longer available.',
        });
      }
      await tx.answer.createMany({
        data: data.answers,
      });

      await tx.result.create({
        data: data.resultData,
      });

      await tx.snapShot.create({
        data: { attemptId: data.attemptId, snapshot: data.snapshot },
      });
    });
  }

  async createAnswerV2(attemptId: number, answers: AnswerDtoV2[]) {
    return this.prisma.answer.createMany({
      data: answers.map((answer) => ({
        attemptId: attemptId,
        questionId: answer.questionId,
        answerValue: answer.check ? 1 : 0,
      })),
    });
  }
  async createAnswer(attemptId: number, answers: AnswerDto[]) {
    return this.prisma.answer.createMany({
      data: answers.map((answer) => ({
        attemptId: attemptId,
        questionId: answer.questionId,
        answerValue: answer.answerValue,
      })),
    });
  }
  async findByAttemptId(attemptId: number) {
    return this.prisma.answer.findMany({
      where: { attemptId },
      select: {
        id: true,
        questionId: true,
        answerValue: true,
      },
    });
  }
}
