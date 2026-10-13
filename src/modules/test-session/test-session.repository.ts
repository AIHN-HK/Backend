import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(id: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const totalQuestions = await tx.question.count();
          if (!totalQuestions)
            throw new BadRequestException('Bộ đề chưa có câu hỏi.');
          return tx.attempt.create({ data: { totalQuestions, userId: id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error.code === 'P2034')
        throw new ConflictException(
          'Bộ đề vừa thay đổi. Hãy thử bắt đầu bài test lại.',
        );
      throw error;
    }
  }

  async findById(id: number) {
    return this.prisma.attempt.findUnique({
      where: { id },
    });
  }

  async remove(id: number) {
    return this.prisma.attempt.delete({
      where: { id },
    });
  }
}
