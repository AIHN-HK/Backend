import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CareerRepository } from './career.repository';
import { CareerProfileInput, CareerQuery } from './career.dto';
import {
  algorithmVersion,
  codes,
  normalizeSnapshot,
  rankCareers,
  ScoringCareer,
  ScoringProfile,
  Vector,
  vector,
} from './domain/scoring';

export function profileData(
  value: { skills: unknown; interests: unknown } | null,
): ScoringProfile {
  const skills = value?.skills;
  if (
    skills !== undefined &&
    (!Array.isArray(skills) ||
      skills.some(
        (s) =>
          !s ||
          typeof s.skillId !== 'string' ||
          typeof s.level !== 'number' ||
          !Number.isFinite(s.level) ||
          s.level < 0 ||
          s.level > 5,
      ))
  )
    throw new BadRequestException('Stored career profile is invalid');
  return {
    skills: (skills ?? []) as ScoringProfile['skills'],
    interests: vector(value?.interests, 5),
  };
}
export function scoringCareer(
  row: Awaited<ReturnType<CareerRepository['career']>>,
): ScoringCareer {
  const riasec = vector(row?.riasec, 7);
  if (!row || !riasec) throw new BadRequestException('Invalid career dataset');
  return { ...row, riasec };
}
@Injectable()
export class CareerService {
  constructor(private readonly repository: CareerRepository) {}
  async list(query: CareerQuery, all = false) {
    if (!query.code)
      return this.repository.list(
        query.q?.trim() ?? '',
        query.page,
        query.limit,
        all,
      );
    // Six dimensions are JSON in sourced data; filter a bounded catalog in memory.
    const rows = await this.repository.published(all);
    const q = query.q?.trim().toLowerCase() ?? '';
    const matches = rows.filter(
      (r) =>
        (!q ||
          `${r.id} ${r.title} ${r.description}`.toLowerCase().includes(q)) &&
        codes
          .slice()
          .sort(
            (a, b) =>
              (vector(r.riasec, 7)?.[b] ?? 0) - (vector(r.riasec, 7)?.[a] ?? 0),
          )[0] === query.code,
    );
    return {
      items: matches.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      total: matches.length,
      page: query.page,
      limit: query.limit,
    };
  }
  skills() {
    return this.repository.skills();
  }
  async detail(id: string) {
    const row = await this.repository.career(id);
    if (!row) throw new NotFoundException('Career not found');
    return row;
  }
  async profile(userId: number) {
    return (
      (await this.repository.profile(userId)) ?? {
        userId,
        revision: 0,
        skills: [],
        interests: null,
        targetCareerId: null,
      }
    );
  }
  async saveProfile(userId: number, input: CareerProfileInput) {
    const ids = new Set(input.skills.map((s) => s.skillId));
    const known = new Set((await this.repository.skills()).map((s) => s.id));
    if (
      ids.size !== input.skills.length ||
      [...ids].some((id) => !known.has(id))
    )
      throw new BadRequestException('Unknown or duplicate skill');
    return this.repository.saveProfile(userId, input);
  }
  async recommend(userId: number, attemptId: number) {
    const [attempt, profile, careers] = await Promise.all([
      this.repository.attempt(userId, attemptId),
      this.repository.profile(userId),
      this.repository.published(),
    ]);
    if (!attempt?.result)
      throw new NotFoundException('Completed owned assessment required');
    const scores: Vector = {
      R: attempt.result.scoreR,
      I: attempt.result.scoreI,
      A: attempt.result.scoreA,
      S: attempt.result.scoreS,
      E: attempt.result.scoreE,
      C: attempt.result.scoreC,
    };
    const normalized = normalizeSnapshot(attempt.snapshots?.snapshot, scores);
    if (!normalized)
      throw new BadRequestException(
        'Comparable binary snapshot required; complete a current assessment',
      );
    if (!careers.length)
      throw new BadRequestException('Career dataset has not been imported');
    const data = profileData(profile);
    const items = rankCareers(
      normalized,
      data,
      careers.map(scoringCareer),
    ).slice(0, 20);
    return this.repository.createRun({
      userId,
      attemptId,
      algorithmVersion,
      input: {
        scores,
        normalized,
        profileRevision: profile?.revision ?? 0,
        profile: data,
        catalog: careers.map((c) => ({
          id: c.id,
          revision: c.revision,
          sourceVersion: c.sourceVersion,
        })),
      } as unknown as Prisma.InputJsonValue,
      items: items as unknown as Prisma.InputJsonValue,
    });
  }
  latest(userId: number) {
    return this.repository.latestRun(userId);
  }
  async run(userId: number, id: string) {
    const run = await this.repository.run(userId, id);
    if (!run) throw new NotFoundException('Recommendation not found');
    return run;
  }
  publish(id: string, revision: number, active: boolean, actorId: number) {
    return this.repository.publish(id, revision, active, actorId);
  }
}
