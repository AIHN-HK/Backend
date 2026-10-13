import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Question } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { recordAdminAudit } from '../audit';
const DIMENSION_VI_MAP: Record<string, string> = {
  PERSONA: 'TÔI LÀ NGƯỜI',
  ABILITY: 'TÔI CÓ THỂ',
  INTEREST: 'TÔI THÍCH',
  UNKNOWN: 'KHÔNG XÁC ĐỊNH',
};
@Injectable()
export class QuestionRepository {
  constructor(private readonly prisma: PrismaService) {}
  private async mutate<T>(
    questionId: number | null,
    write: (tx: Prisma.TransactionClient) => Promise<T>,
    actorId?: number,
    action = 'updated',
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (await tx.attempt.count({ where: { finishAt: null } })) {
            throw new ConflictException(
              'Có bài test đang làm. Chưa thể thay đổi ngân hàng câu hỏi.',
            );
          }
          if (
            questionId !== null &&
            (await tx.answer.count({ where: { questionId } }))
          ) {
            throw new ConflictException(
              'Câu hỏi đã được sử dụng. Cần phiên bản bộ đề mới để thay đổi.',
            );
          }
          const before =
            actorId !== undefined && questionId !== null
              ? await tx.question.findUnique({ where: { id: questionId } })
              : null;
          const result = await write(tx);
          const targetId =
            questionId !== null
              ? String(questionId)
              : Array.isArray(result)
                ? 'bulk'
                : String((result as { id: number }).id);
          await recordAdminAudit(
            tx,
            actorId,
            'Question',
            action,
            targetId,
            before,
            action === 'deleted' ? null : result,
          );
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error.code === 'P2034')
        throw new ConflictException(
          'Dữ liệu vừa thay đổi. Hãy tải lại trước khi lưu.',
        );
      throw error;
    }
  }
  async create(data: Prisma.QuestionCreateInput, actorId?: number) {
    return this.mutate(
      null,
      (tx) => tx.question.create({ data }),
      actorId,
      'created',
    );
  }
  async update(id: number, data: Prisma.QuestionUpdateInput, actorId?: number) {
    return this.mutate(
      id,
      (tx) =>
        tx.question.update({
          where: { id },
          data,
        }),
      actorId,
    );
  }
  async findByid(id: number) {
    return this.prisma.question.findUnique({
      where: { id },
    });
  }
  async remove(id: number, actorId?: number) {
    return this.mutate(
      id,
      (tx) =>
        tx.question.delete({
          where: { id },
        }),
      actorId,
      'deleted',
    );
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

  async createManyQuestion(question: CreateQuestionDto[], actorId?: number) {
    return this.mutate(
      null,
      (tx) => tx.question.createManyAndReturn({ data: question }),
      actorId,
      'bulk-created',
    );
  }
  async countQuestions() {
    return this.prisma.question.count();
  }
}
