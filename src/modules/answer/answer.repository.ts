import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { AnswerDto, AnswerDtoV2 } from './dto/create_answer.dto';

@Injectable()
export class AnswerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async submitAnswerTransaction(data: {
    attemptId: number;
    answers: Prisma.AnswerCreateManyInput[];
    resultData: Prisma.ResultCreateInput;
    completedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.answer.createMany({
        data: data.answers,
        skipDuplicates: true,
      });

      await tx.result.create({
        data: data.resultData,
      });

      await tx.attempt.update({
        where: {
          id: data.attemptId,
          finishAt: null,
        },
        data: {
          finishAt: data.completedAt,
        },
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
