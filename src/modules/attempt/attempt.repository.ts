import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class AttemptRepository {
  constructor(private readonly prismaService: PrismaService) {}
  async markFinish(attemptId: number, data: { completedAt: Date }) {
    return this.prismaService.attempt.update({
      where: { id: attemptId },
      data: {
        finishAt: data.completedAt,
      },
    });
  }
  async findByIdAndUser(attemptId: number, userId: number) {
    return this.prismaService.attempt.findFirst({
      where: {
        id: attemptId,
        userId: userId,
      },
      select: {
        id: true,
        finishAt: true,
        totalQuestions: true,
      },
    });
  }
  async findById(attemptId: number) {
    return this.prismaService.attempt.findUnique({
      where: { id: attemptId },
    });
  }
  async countAnswers(attemptId: number) {
    return this.prismaService.answer.count({
      where: { attemptId: attemptId },
    });
  }
  async FindAnswerwithQuestion(attemptId: number) {
    return this.prismaService.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });
  }
  async getAttemptHistory(
    userId: number,
    limit: number,
    cursorCreatedAt?: Date,
    cursorId?: number,
  ) {
    return this.prismaService.attempt.findMany({
      where: {
        userId,
        finishAt: { not: null },
        result: { isNot: null },
        ...(cursorCreatedAt &&
          cursorId && {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              {
                createdAt: cursorCreatedAt,
                id: { lt: cursorId },
              },
            ],
          }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        result: true,
      },
    });
  }
}
