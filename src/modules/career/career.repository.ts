import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { recordAdminAudit } from '../audit';
import { CareerProfileInput } from './career.dto';

export const careerInclude = {
  skills: { include: { skill: true }, orderBy: { skillId: 'asc' as const } },
};
@Injectable()
export class CareerRepository {
  constructor(private readonly db: PrismaService) {}
  async list(q: string, page: number, limit: number, all = false) {
    const where: Prisma.CareerWhereInput = {
      ...(!all ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { id: { contains: q } },
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      async (tx) => {
        const [items, total] = await Promise.all([
          tx.career.findMany({
            where,
            orderBy: { id: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            include: careerInclude,
          }),
          tx.career.count({ where }),
        ]);
        return { items, total, page, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  skills() {
    return this.db.skill.findMany({ orderBy: { name: 'asc' } });
  }
  career(id: string, all = false) {
    return this.db.career.findFirst({
      where: { id, ...(!all ? { active: true } : {}) },
      include: careerInclude,
    });
  }
  published(all = false) {
    return this.db.career.findMany({
      where: all ? {} : { active: true },
      orderBy: { id: 'asc' },
      include: careerInclude,
    });
  }
  profile(userId: number) {
    return this.db.careerProfile.findUnique({ where: { userId } });
  }
  async saveProfile(userId: number, input: CareerProfileInput) {
    return this.db.$transaction(async (tx) => {
      const target = input.targetCareerId
        ? await tx.career.findFirst({
            where: { id: input.targetCareerId, active: true },
          })
        : null;
      if (input.targetCareerId && !target)
        throw new NotFoundException('Career target unavailable');
      const data = {
        skills: input.skills as unknown as Prisma.InputJsonValue,
        interests: input.interests ? { ...input.interests } : Prisma.DbNull,
        targetCareerId: input.targetCareerId ?? null,
      };
      if (input.revision === 0) {
        try {
          return await tx.careerProfile.create({ data: { userId, ...data } });
        } catch (error) {
          if (error.code === 'P2002')
            throw new ConflictException(
              'Profile changed; reload before saving',
            );
          throw error;
        }
      }
      const updated = await tx.careerProfile.updateMany({
        where: { userId, revision: input.revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException('Profile changed; reload before saving');
      return tx.careerProfile.findUniqueOrThrow({ where: { userId } });
    });
  }
  attempt(userId: number, id: number) {
    return this.db.attempt.findFirst({
      where: { userId, id, finishAt: { not: null }, result: { isNot: null } },
      include: { result: true, snapshots: true },
    });
  }
  createRun(data: Prisma.RecommendationRunUncheckedCreateInput) {
    return this.db.recommendationRun.create({ data });
  }
  latestRun(userId: number) {
    return this.db.recommendationRun.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
  run(userId: number, id: string) {
    return this.db.recommendationRun.findFirst({ where: { id, userId } });
  }
  async publish(
    id: string,
    revision: number,
    active: boolean,
    actorId: number,
  ) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.career.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Career not found');
      const changed = await tx.career.updateMany({
        where: { id, revision },
        data: { active, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('Career changed; reload before saving');
      const after = await tx.career.findUniqueOrThrow({ where: { id } });
      await recordAdminAudit(
        tx,
        actorId,
        'Career',
        active ? 'published' : 'archived',
        id,
        before,
        after,
      );
      return after;
    });
  }
}
