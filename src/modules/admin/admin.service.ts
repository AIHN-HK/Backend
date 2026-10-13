import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { recordAdminAudit } from '../../core/database/admin-audit';
import { RedisService } from '../../core/redis/redis.service';
import { AdminPageDto, AdminPrioritiesDto } from './admin.dto';

const studentSelect = {
  id: true,
  fullname: true,
  email: true,
  class: true,
  phone: true,
  address: true,
  gender: true,
  yob: true,
  createdAt: true,
};
const resultSelect = {
  topCode: true,
  scoreR: true,
  scoreI: true,
  scoreA: true,
  scoreS: true,
  scoreE: true,
  scoreC: true,
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async overview() {
    const completed = {
      finishAt: { not: null },
      user: { role: 'USER' },
      result: { isNot: null },
    };
    const [students, completedTests, chatSessions, questions, recentAttempts] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'USER' } }),
        this.prisma.attempt.count({ where: completed }),
        this.prisma.chatSession.count({ where: { user: { role: 'USER' } } }),
        this.prisma.question.count(),
        this.prisma.attempt.findMany({
          where: completed,
          take: 5,
          orderBy: [{ finishAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            finishAt: true,
            result: { select: resultSelect },
            user: { select: { id: true, fullname: true } },
          },
        }),
      ]);
    return {
      counts: { students, completedTests, chatSessions, questions },
      recentAttempts,
    };
  }

  async students({ q, page, limit }: AdminPageDto) {
    const where: Prisma.UserWhereInput = {
      role: 'USER',
      ...(q
        ? {
            OR: [
              { fullname: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction(async (tx) =>
      Promise.all([
        tx.user.findMany({
          where,
          select: studentSelect,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        tx.user.count({ where }),
      ]),
    );
    return { items, total, page, limit };
  }

  async student(id: number, { page, limit }: AdminPageDto) {
    const student = await this.prisma.user.findFirst({
      where: { id, role: 'USER' },
      select: studentSelect,
    });
    if (!student) throw new NotFoundException('Không tìm thấy học sinh.');
    const where = {
      userId: id,
      finishAt: { not: null },
      result: { isNot: null },
    };
    const [items, total] = await this.prisma.$transaction(async (tx) =>
      Promise.all([
        tx.attempt.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ finishAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            finishAt: true,
            totalQuestions: true,
            result: { select: resultSelect },
          },
        }),
        tx.attempt.count({ where }),
      ]),
    );
    return { student, attempts: { items, total, page, limit } };
  }

  async questions() {
    const [items, activeAttempts] = await Promise.all([
      this.prisma.question.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          content: true,
          type: true,
          dimension: true,
          _count: { select: { answers: true } },
        },
      }),
      this.prisma.attempt.count({ where: { finishAt: null } }),
    ]);
    return {
      activeAttempts,
      items: items.map(({ _count, ...question }) => ({
        ...question,
        used: _count.answers > 0,
        editable: !_count.answers && !activeAttempts,
      })),
    };
  }

  topcodes() {
    return this.prisma.topCode.findMany({ orderBy: { id: 'asc' } });
  }

  async priorities({ priorities }: AdminPrioritiesDto, actorId?: number) {
    if (
      new Set(priorities.map((p) => p.type)).size !== 6 ||
      new Set(priorities.map((p) => p.priority)).size !== 6
    ) {
      throw new BadRequestException(
        'Cần đủ 6 nhóm và thứ tự duy nhất từ 1 đến 6.',
      );
    }
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const rows = await tx.priority.findMany();
          if (
            rows.length !== 6 ||
            new Set(rows.map((p) => p.type)).size !== 6 ||
            priorities.some((p) => !rows.some((row) => row.type === p.type))
          ) {
            throw new ConflictException(
              'Bảng độ ưu tiên chưa có đủ 6 nhóm hợp lệ.',
            );
          }
          const updated = await Promise.all(
            priorities.map((p) =>
              tx.priority.update({
                where: { id: rows.find((row) => row.type === p.type).id },
                data: { priority: p.priority },
              }),
            ),
          );
          await recordAdminAudit(
            tx,
            actorId,
            'Priority',
            'reordered',
            'all',
            rows,
            updated,
          );
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.redis.del('priority:all').catch(() => undefined);
      return result;
    } catch (error) {
      if (error.code === 'P2034')
        throw new ConflictException(
          'Dữ liệu vừa thay đổi. Hãy tải lại trước khi lưu.',
        );
      throw error;
    }
  }
}
