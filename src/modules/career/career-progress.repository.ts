import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { PlannedTask } from './domain/roadmap';
const include = { tasks: { orderBy: { position: 'asc' as const } } };
@Injectable()
export class CareerProgressRepository {
  constructor(private readonly db: PrismaService) {}
  goals(userId: number) {
    return this.db.careerGoal.findMany({
      where: { userId },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }
  async create(
    userId: number,
    careerId: string,
    title: string,
    evidence: Prisma.InputJsonValue,
    tasks: PlannedTask[],
  ) {
    try {
      return await this.db.careerGoal.create({
        data: { userId, careerId, title, evidence, tasks: { create: tasks } },
        include,
      });
    } catch (error) {
      if (error.code === 'P2002')
        throw new ConflictException('Goal already exists; review its progress');
      throw error;
    }
  }
  async update(
    userId: number,
    goalId: string,
    taskId: string,
    revision: number,
    done: boolean,
    evidence: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const goal = await tx.careerGoal.findFirst({
        where: { id: goalId, userId },
        include,
      });
      if (!goal || !goal.tasks.some((t) => t.id === taskId))
        throw new NotFoundException('Goal task not found');
      const claimed = await tx.careerGoal.updateMany({
        where: { id: goalId, userId, revision },
        data: { revision: { increment: 1 } },
      });
      if (claimed.count !== 1)
        throw new ConflictException('Goal changed; reload before saving');
      const task = goal.tasks.find((t) => t.id === taskId)!;
      if (done && !evidence.trim())
        throw new BadRequestException('Describe completion evidence');
      if (done && goal.tasks.some((t) => t.phase < task.phase && !t.done))
        throw new ConflictException('Complete earlier roadmap phases first');
      if (!done && goal.tasks.some((t) => t.phase > task.phase && t.done))
        throw new ConflictException(
          'Reopen later phases before an earlier task',
        );
      await tx.goalTask.update({
        where: { id: taskId },
        data: { done, evidence },
      });
      return tx.careerGoal.findUniqueOrThrow({
        where: { id: goalId },
        include,
      });
    });
  }
  async regenerate(
    userId: number,
    goalId: string,
    revision: number,
    evidence: Prisma.InputJsonValue,
    tasks: PlannedTask[],
  ) {
    return this.db.$transaction(async (tx) => {
      const goal = await tx.careerGoal.findFirst({
        where: { id: goalId, userId },
        include,
      });
      if (!goal) throw new NotFoundException('Goal not found');
      const changed = await tx.careerGoal.updateMany({
        where: { id: goalId, userId, revision },
        data: { evidence, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('Goal changed; reload before regenerating');
      // Retain completed/annotated tasks even if a changed profile no longer needs them.
      const retained = goal.tasks.filter(
        (old) => old.done || old.evidence.trim(),
      );
      const next = tasks.map((t) => {
        const old = goal.tasks.find(
          (o) => o.skillId === t.skillId && o.kind === t.kind,
        );
        return {
          ...t,
          ...(old
            ? { id: old.id, done: old.done, evidence: old.evidence }
            : {}),
        };
      });
      for (const old of retained)
        if (!next.some((t) => t.id === old.id))
          next.push({ ...old, position: next.length });
      await tx.goalTask.deleteMany({ where: { goalId } });
      await tx.goalTask.createMany({
        data: next.map(({ ...t }) => ({ ...t, goalId })),
      });
      return tx.careerGoal.findUniqueOrThrow({
        where: { id: goalId },
        include,
      });
    });
  }
  async timeline(userId: number) {
    return this.db.attempt.findMany({
      where: { userId, finishAt: { not: null }, result: { isNot: null } },
      orderBy: [{ finishAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { result: true, snapshots: true },
    });
  }
  async counts(userId: number) {
    const [assessments, chats, runs] = await Promise.all([
      this.db.attempt.count({
        where: { userId, finishAt: { not: null }, result: { isNot: null } },
      }),
      this.db.chatSession.count({ where: { userId } }),
      this.db.recommendationRun.count({ where: { userId } }),
    ]);
    return { assessments, chats, runs };
  }
  async adminAnalytics() {
    const [
      careers,
      skills,
      recommendations,
      goals,
      completedTasks,
      totalTasks,
      distribution,
    ] = await Promise.all([
      this.db.career.count({ where: { active: true } }),
      this.db.skill.count(),
      this.db.recommendationRun.count(),
      this.db.careerGoal.count(),
      this.db.goalTask.count({ where: { done: true } }),
      this.db.goalTask.count(),
      this.db.result.groupBy({
        by: ['topCode'],
        where: { attempt: { finishAt: { not: null } } },
        _count: { _all: true },
      }),
    ]);
    return {
      careers,
      skills,
      recommendations,
      goals,
      completedTasks,
      totalTasks,
      distribution,
    };
  }
}
