import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CareerRepository } from './career.repository';
import { CareerProgressRepository } from './career-progress.repository';
import { profileData, scoringCareer } from './career.service';
import { codes, normalizeSnapshot, skillGaps, Vector } from './domain/scoring';
import { planRoadmap } from './domain/roadmap';

@Injectable()
export class CareerProgressService {
  constructor(
    private readonly repository: CareerProgressRepository,
    private readonly careers: CareerRepository,
  ) {}
  async gap(userId: number, careerId: string) {
    const [row, profile] = await Promise.all([
      this.careers.career(careerId),
      this.careers.profile(userId),
    ]);
    if (!row) throw new NotFoundException('Published career not found');
    return {
      careerId,
      profileRevision: profile?.revision ?? 0,
      sourceVersion: row.sourceVersion,
      sourceUrl: row.sourceUrl,
      gaps: skillGaps(row.skills, profileData(profile)).map((g) => ({
        ...g,
        name: row.skills.find((s) => s.skillId === g.skillId)!.skill.name,
      })),
    };
  }
  async prepare(userId: number, careerId: string) {
    const [row, profile, names] = await Promise.all([
      this.careers.career(careerId),
      this.careers.profile(userId),
      this.careers.skills(),
    ]);
    if (!row) throw new NotFoundException('Published career not found');
    const career = scoringCareer(row),
      data = profileData(profile);
    return {
      title: career.title,
      tasks: planRoadmap(
        career,
        data,
        new Map(names.map((s) => [s.id, s.name])),
      ),
      evidence: {
        profileRevision: profile?.revision ?? 0,
        sourceVersion: career.sourceVersion,
        sourceUrl: career.sourceUrl,
        gaps: skillGaps(career.skills, data),
      } as unknown as Prisma.InputJsonValue,
    };
  }
  async create(userId: number, careerId: string) {
    const p = await this.prepare(userId, careerId);
    return this.repository.create(
      userId,
      careerId,
      p.title,
      p.evidence,
      p.tasks,
    );
  }
  goals(userId: number) {
    return this.repository.goals(userId);
  }
  update(
    userId: number,
    goalId: string,
    taskId: string,
    revision: number,
    done: boolean,
    evidence: string,
  ) {
    return this.repository.update(
      userId,
      goalId,
      taskId,
      revision,
      done,
      evidence,
    );
  }
  async regenerate(userId: number, goalId: string, revision: number) {
    const goal = (await this.repository.goals(userId)).find(
      (g) => g.id === goalId,
    );
    if (!goal) throw new NotFoundException('Goal not found');
    const p = await this.prepare(userId, goal.careerId);
    return this.repository.regenerate(
      userId,
      goalId,
      revision,
      p.evidence,
      p.tasks,
    );
  }
  async analytics(userId: number) {
    const [attempts, counts, goals] = await Promise.all([
      this.repository.timeline(userId),
      this.repository.counts(userId),
      this.repository.goals(userId),
    ]);
    const timeline = attempts.map((a) => {
      const r = a.result!;
      const scores: Vector = {
        R: r.scoreR,
        I: r.scoreI,
        A: r.scoreA,
        S: r.scoreS,
        E: r.scoreE,
        C: r.scoreC,
      };
      return {
        attemptId: a.id,
        finishAt: a.finishAt,
        topCode: r.topCode,
        scores,
        normalized: normalizeSnapshot(a.snapshots?.snapshot, scores),
      };
    });
    const [latest, previous] = timeline;
    const delta =
      latest?.normalized && previous?.normalized
        ? Object.fromEntries(
            codes.map((c) => [
              c,
              latest.normalized![c] - previous.normalized![c],
            ]),
          )
        : null;
    return {
      counts,
      timeline,
      delta,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        total: g.tasks.length,
        completed: g.tasks.filter((t) => t.done).length,
      })),
      timelineLimit: 50,
    };
  }
  adminAnalytics() {
    return this.repository.adminAnalytics();
  }
  async advisorContext(userId: number) {
    const [profile, goals, run] = await Promise.all([
      this.careers.profile(userId),
      this.repository.goals(userId),
      this.careers.latestRun(userId),
    ]);
    const target = profile?.targetCareerId
      ? await this.careers.career(profile.targetCareerId)
      : null;
    const gap = target ? await this.gap(userId, target.id) : null;
    return {
      profile: profileData(profile),
      profileRevision: profile?.revision ?? 0,
      target: target
        ? {
            id: target.id,
            title: target.title,
            sourceVersion: target.sourceVersion,
            sourceUrl: target.sourceUrl,
          }
        : null,
      gap,
      recommendation: run
        ? {
            id: run.id,
            algorithmVersion: run.algorithmVersion,
            createdAt: run.createdAt,
            inputProfileRevision: (run.input as { profileRevision?: number })
              .profileRevision,
            items: Array.isArray(run.items) ? run.items.slice(0, 3) : [],
          }
        : null,
      roadmaps: goals.slice(0, 3).map((g) => ({
        title: g.title,
        source: g.evidence,
        total: g.tasks.length,
        completed: g.tasks.filter((t) => t.done).length,
        tasks: g.tasks.slice(0, 12).map((t) => ({
          title: t.title,
          done: t.done,
          evidence: t.evidence.slice(0, 200),
        })),
      })),
    };
  }
}
