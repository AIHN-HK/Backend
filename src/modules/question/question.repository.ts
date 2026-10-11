import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Question } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
const DIMENSION_VI_MAP: Record<string, string> = {
  PERSONA: 'TÔI LÀ NGƯỜI',
  ABILITY: 'TÔI CÓ THỂ',
  INTEREST: 'TÔI THÍCH',
  UNKNOWN: 'KHÔNG XÁC ĐỊNH',
};
@Injectable()
export class QuestionRepository {
  constructor(private readonly prisma: PrismaService) {}
  private async mutate<T>(questionId: number | null, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async tx => {
        if (await tx.attempt.count({ where: { finishAt: null } })) {
          throw new ConflictException('Có bài test đang làm. Chưa thể thay đổi ngân hàng câu hỏi.');
        }
        if (questionId !== null && await tx.answer.count({ where: { questionId } })) {
          throw new ConflictException('Câu hỏi đã được sử dụng. Cần phiên bản bộ đề mới để thay đổi.');
        }
        return write(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error.code === 'P2034') throw new ConflictException('Dữ liệu vừa thay đổi. Hãy tải lại trước khi lưu.');
      throw error;
    }
  }
  async create(data: Prisma.QuestionCreateInput) {
    return this.mutate(null, tx => tx.question.create({ data }));
  }
  async update(id: number, data: Prisma.QuestionUpdateInput) {
    return this.mutate(id, tx => tx.question.update({
      where: { id },
      data,
    }));
  }
  async findByid(id: number) {
    return this.prisma.question.findUnique({
      where: { id },
    });
  }
  async remove(id: number) {
    return this.mutate(id, tx => tx.question.delete({
      where: { id },
    }));
  }

  async getALL() {
    const question = await this.prisma.question.findMany({
      orderBy: { id: 'asc' },
    });
    return question.reduce(
      (acc, q) => {
        const dim = q.dimension ?? 'UNKNOWN';
        const dimviet = DIMENSION_VI_MAP[dim] ?? dim;
        acc[q.type] ??= {};
        acc[q.type][dimviet] ??= [];
        acc[q.type][dimviet].push(q);
        return acc;
      },
      {} as Record<string, Record<string, Question[]>>,
    );
  }
  async findQuestionsByIdsDetailed(questionIds: number[]) {
    return this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        type: true,
        content: true,
        dimension: true,
      },
    });
  }

  async createManyQuestion(question: CreateQuestionDto[]) {
    return this.mutate(null, async tx => {
      await tx.question.createMany({ data: question });
      return tx.question.findMany({
      where: {
        content: {
          in: question.map((q) => q.content),
        },
      },
      });
    });
  }
  async countQuestions() {
    return this.prisma.question.count();
  }
}
