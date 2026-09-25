import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(totalQuestions: number, id: number) {
    return this.prisma.attempt.create({ data: { totalQuestions, userId: id } });
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
