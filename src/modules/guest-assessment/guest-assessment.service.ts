import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomUUID } from 'node:crypto';
import { RIASEC_KEYS, ScoreCalculatorService } from '../assessment';
import { ResultRepository } from '../result';
import { GuestAssessmentRepository } from './guest-assessment.repository';
import type {
  GuestCatalog,
  GuestOutcome,
  GuestReceipt,
} from './guest-assessment.types';
import type { GuestPreviewDto } from './guest-assessment.dto';

@Injectable()
export class GuestAssessmentService {
  constructor(
    private readonly repository: GuestAssessmentRepository,
    private readonly results: ResultRepository,
    private readonly calculator: ScoreCalculatorService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private secret() {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update('aihn.guest-assessment.v1')
      .digest('hex');
  }
  private sign(payload: GuestCatalog | GuestReceipt) {
    const token = this.jwt.sign(payload, {
      secret: this.secret(),
      algorithm: 'HS256',
      audience: 'guest-assessment',
      issuer: 'aihn',
      expiresIn: Math.max(
        1,
        Math.floor((payload.expiresAt - Date.now()) / 1000),
      ),
    });
    if (token.length > 75000)
      throw new BadRequestException(
        'Question bank is too large for a guest session.',
      );
    return token;
  }
  private read<T extends GuestCatalog | GuestReceipt>(
    token: string,
    kind: T['kind'],
  ): T {
    try {
      if (typeof token !== 'string' || token.length > 75000)
        throw new Error('Invalid token');
      const value = this.jwt.verify<T>(token, {
        secret: this.secret(),
        algorithms: ['HS256'],
        audience: 'guest-assessment',
        issuer: 'aihn',
      });
      if (
        value.version !== 1 ||
        value.kind !== kind ||
        value.expiresAt <= Date.now()
      )
        throw new Error('Expired session');
      return value;
    } catch {
      throw new BadRequestException({
        code: 'GUEST_SESSION_EXPIRED',
        message: 'Guest test is invalid or expired. Take a new test.',
      });
    }
  }
  async catalog() {
    const [questions, priorities] = await this.repository.catalog();
    if (
      !questions.length ||
      questions.length > 1000 ||
      questions.some((q) => !RIASEC_KEYS.includes(q.type as any)) ||
      priorities.length !== 6 ||
      new Set(priorities.map((p) => p.type)).size !== 6 ||
      priorities.some((p) => !RIASEC_KEYS.includes(p.type as any)) ||
      new Set(priorities.map((p) => p.priority)).size !== 6
    )
      throw new BadRequestException(
        'The assessment question bank or tie priorities are not ready.',
      );
    const payload: GuestCatalog = {
      version: 1,
      kind: 'catalog',
      id: randomUUID(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      questions: questions as GuestCatalog['questions'],
      priorities: priorities as GuestCatalog['priorities'],
    };
    return {
      id: payload.id,
      expiresAt: payload.expiresAt,
      questions: payload.questions,
      catalogToken: this.sign(payload),
    };
  }
  private score(
    catalog: GuestCatalog | GuestReceipt,
    answers: GuestPreviewDto['answers'],
  ): GuestOutcome {
    const ids = new Set(answers.map((a) => a.questionId));
    if (
      answers.length !== catalog.questions.length ||
      ids.size !== answers.length ||
      answers.some((a) => typeof a.check !== 'boolean') ||
      catalog.questions.some((q) => !ids.has(q.id)) ||
      !answers.some((a) => a.check)
    )
      throw new BadRequestException(
        'Answer every question once with boolean check; select Yes at least once.',
      );
    const selected = new Set(
      answers.filter((a) => a.check).map((a) => a.questionId),
    );
    const { score } = this.calculator.calculateScores(
      catalog.questions.filter((q) => selected.has(q.id)),
    );
    const topCode = [...catalog.priorities]
      .sort((a, b) => score[b.type] - score[a.type] || a.priority - b.priority)
      .slice(0, 3)
      .map((p) => p.type)
      .join('');
    return { scores: score, topCode };
  }
  async preview(input: GuestPreviewDto) {
    const catalog = this.read<GuestCatalog>(input.catalogToken, 'catalog');
    const answers = [...input.answers].sort(
      (a, b) => a.questionId - b.questionId,
    );
    const outcome = this.score(catalog, answers);
    const receipt: GuestReceipt = {
      ...catalog,
      kind: 'receipt',
      answers,
      completedAt: new Date().toISOString(),
    };
    // Never forward JWT's iat/exp fields into a newly signed token.
    const { version, id, expiresAt, questions, priorities, kind, completedAt } =
      receipt;
    return {
      ...outcome,
      id,
      expiresAt,
      receipt: this.sign({
        version,
        id,
        expiresAt,
        questions,
        priorities,
        kind,
        answers,
        completedAt,
      }),
      snapshot: {
        result: {
          scoreR: outcome.scores.R,
          scoreI: outcome.scores.I,
          scoreA: outcome.scores.A,
          scoreS: outcome.scores.S,
          scoreE: outcome.scores.E,
          scoreC: outcome.scores.C,
          topCode: outcome.topCode,
        },
        questions: questions.map((q) => ({
          ...q,
          answerValue: answers.find((a) => a.questionId === q.id)!.check
            ? 1
            : 0,
        })),
      },
      analysis: await this.results.findAnalyzeResult(
        outcome.topCode,
        outcome.scores,
      ),
    };
  }
  async claim(token: string, userId: number) {
    const receipt = this.read<GuestReceipt>(token, 'receipt');
    return this.repository.claim(
      receipt,
      this.score(receipt, receipt.answers),
      userId,
    );
  }
  lookup(id: string, userId: number) {
    return this.repository.lookup(id, userId);
  }
}
