import { Injectable } from '@nestjs/common';
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
  async create(data: Prisma.QuestionCreateInput) {
    return this.prisma.question.create({ data });
  }
  async update(id: number, data: Prisma.QuestionUpdateInput) {
    return this.prisma.question.update({
      where: { id },
      data,
    });
  }
  async findByid(id: number) {
    return this.prisma.question.findUnique({
      where: { id },
    });
  }
  async remove(id: number) {
    return this.prisma.question.delete({
      where: { id },
    });
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
    await this.prisma.question.createMany({
      data: question,
    });
    return this.prisma.question.findMany({
      where: {
        content: {
          in: question.map((q) => q.content),
        },
      },
    });
  }
  async countQuestions() {
    return this.prisma.question.count();
  }
}
