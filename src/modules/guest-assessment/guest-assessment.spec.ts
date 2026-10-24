import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuestAssessmentService } from './guest-assessment.service';
import { GuestAssessmentRepository } from './guest-assessment.repository';
import { GuestAssessmentController } from './guest-assessment.controller';
import { GuestPreviewDto } from './guest-assessment.dto';
import { ScoreCalculatorService } from '../assessment';
import { IS_PUBLIC_KEY } from '../../core/decorators/public.decorator';

const questions = [
  { id: 1, content: 'Build', type: 'R', dimension: 'INTEREST' },
  { id: 2, content: 'Research', type: 'I', dimension: 'PERSONA' },
];
const priorities = ['I', 'R', 'A', 'S', 'E', 'C'].map((type, i) => ({
  type,
  priority: i + 1,
}));
const answers = [
  { questionId: 1, check: false },
  { questionId: 2, check: true },
];
function setup() {
  const repository = {
    catalog: jest.fn(async () => [questions, priorities]),
    claim: jest.fn<Promise<{ attemptId: number }>, any[]>(async () => ({
      attemptId: 81,
    })),
    lookup: jest.fn(async () => ({ attemptId: 81 })),
  };
  const results = { findAnalyzeResult: jest.fn(async () => []) };
  const service = new GuestAssessmentService(
    repository as any,
    results as any,
    new ScoreCalculatorService(),
    new JwtService(),
    new ConfigService({ JWT_ACCESS_SECRET: 'guest-assessment-test-key' }),
  );
  return { service, repository };
}
describe('guest assessment signed preview', () => {
  it('keeps catalog and result anonymous without any write, and preserves false answers', async () => {
    const { service, repository } = setup();
    const catalog = await service.catalog();
    const preview = await service.preview({
      catalogToken: catalog.catalogToken,
      answers,
    });
    expect(preview.scores).toEqual({ R: 0, I: 1, A: 0, S: 0, E: 0, C: 0 });
    expect(preview.topCode).toBe('IRA');
    expect(preview.snapshot.questions.map((q) => q.answerValue)).toEqual([
      0, 1,
    ]);
    expect(repository.claim).not.toHaveBeenCalled();
    await service.claim(preview.receipt, 71);
    expect(repository.claim.mock.calls[0][0].answers).toEqual(answers);
    expect(repository.claim.mock.calls[0][2]).toBe(71);
  });
  it('matches the existing Boolean scoring and freezes tie priorities for the guest session', async () => {
    const { service } = setup();
    const catalog = await service.catalog();
    const preview = await service.preview({
      catalogToken: catalog.catalogToken,
      answers: answers.map((a) => ({ ...a, check: true })),
    });
    expect(preview.scores).toEqual(
      new ScoreCalculatorService().calculateScores(questions as any).score,
    );
    expect(preview.topCode).toBe('IRA');
  });
  it.each([
    [{ questionId: 1, check: true }],
    [
      { questionId: 1, check: true },
      { questionId: 1, check: true },
    ],
    [
      { questionId: 1, check: true },
      { questionId: 99, check: false },
    ],
    answers.map((a) => ({ ...a, check: false })),
    [
      { questionId: 1, check: 1 },
      { questionId: 2, check: false },
    ],
  ])(
    'rejects incomplete, duplicate, invalid, all-No and non-Boolean answers: %j',
    async (...input) => {
      const { service } = setup();
      const catalog = await service.catalog();
      // it.each spreads the two row entries, so reconstruct the answer array.
      const values = input.filter(
        (value) => typeof value === 'object' && value !== null,
      );
      await expect(
        service.preview({
          catalogToken: catalog.catalogToken,
          answers: values as any,
        }),
      ).rejects.toThrow();
    },
  );
  it('rejects edited and expired receipts, and prevents using an auth token as a guest proof', async () => {
    const { service, repository } = setup();
    const catalog = await service.catalog();
    const preview = await service.preview({
      catalogToken: catalog.catalogToken,
      answers,
    });
    const [header, payload, signature] = preview.receipt.split('.');
    const modified = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        answers: [],
      }),
    ).toString('base64url');
    await expect(
      service.claim(`${header}.${modified}.${signature}`, 71),
    ).rejects.toThrow();
    await expect(service.claim(catalog.catalogToken, 71)).rejects.toThrow();
    await expect(
      service.claim(
        new JwtService().sign(
          { sub: 71 },
          { secret: 'guest-assessment-test-key' },
        ),
        71,
      ),
    ).rejects.toThrow();
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(catalog.expiresAt + 1000);
    try {
      await expect(service.claim(preview.receipt, 71)).rejects.toThrow();
    } finally {
      clock.mockRestore();
    }
    expect(repository.claim).not.toHaveBeenCalled();
  });
  it('only marks catalog and preview public, keeping claim and reconciliation protected', () => {
    const proto = GuestAssessmentController.prototype;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.catalog)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.preview)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.claim)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.lookup)).toBeUndefined();
  });
  it('validates Boolean DTO values without coercing strings or accepting extra fields', async () => {
    const value = plainToInstance(GuestPreviewDto, {
      catalogToken: 'test',
      answers: [{ questionId: 1, check: 'false' }],
      userId: 72,
    });
    expect(
      (await validate(value, { whitelist: true, forbidNonWhitelisted: true }))
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('guest claim durable ownership and atomic snapshot', () => {
  async function proof() {
    const { service } = setup();
    const catalog = await service.catalog();
    const preview = await service.preview({
      catalogToken: catalog.catalogToken,
      answers,
    });
    const { service: second, repository } = setup();
    await second.claim(preview.receipt, 71);
    return repository.claim.mock.calls[0] as any[];
  }
  it('writes attempt, all answers including No, result, snapshot and unique owner claim atomically', async () => {
    const create = jest.fn(async () => ({ id: 81 }));
    const tx = {
      guestAssessmentClaim: { findUnique: async () => null },
      question: { findMany: async () => questions },
      attempt: { create },
    };
    const prisma = { ...tx, $transaction: async (fn) => fn(tx) };
    const repository = new GuestAssessmentRepository(prisma as any);
    const [receipt, outcome] = await proof();
    await expect(repository.claim(receipt, outcome, 71)).resolves.toEqual({
      attemptId: 81,
    });
    const data = (create.mock.calls[0] as any)[0].data;
    expect(data.userId).toBe(71);
    expect(data.answers.create.map((a) => a.answerValue)).toEqual([0, 1]);
    expect(
      data.snapshots.create.snapshot.questions.map((q) => q.answerValue),
    ).toEqual([0, 1]);
    expect(data.result.create.topCode).toBe('IRA');
    expect(data.guestClaim.create.id).toBe(receipt.id);
  });
  it('returns the same attempt for an exact retry and rejects other owners or changed answers', async () => {
    const [receipt, outcome] = await proof();
    const create = jest.fn();
    const prisma = {
      guestAssessmentClaim: { findUnique: jest.fn(async () => null) },
      $transaction: async (fn) =>
        fn({
          guestAssessmentClaim: { findUnique: async () => null },
          question: { findMany: async () => questions },
          attempt: { create },
        }),
    };
    const repository = new GuestAssessmentRepository(prisma as any);
    // Obtain the real digest from the nested transaction write.
    create.mockResolvedValue({ id: 81 });
    await repository.claim(receipt, outcome, 71);
    const digest = create.mock.calls[0][0].data.guestClaim.create.digest;
    prisma.guestAssessmentClaim.findUnique.mockResolvedValue({
      userId: 71,
      attemptId: 81,
      digest,
    } as never);
    await expect(repository.claim(receipt, outcome, 71)).resolves.toEqual({
      attemptId: 81,
    });
    await expect(repository.claim(receipt, outcome, 72)).rejects.toThrow();
    await expect(
      repository.claim(
        {
          ...receipt,
          answers: [
            { questionId: 1, check: true },
            { questionId: 2, check: true },
          ],
        },
        outcome,
        71,
      ),
    ).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('keeps old guest answers out of a changed question bank and hides another owner claim', async () => {
    const [receipt, outcome] = await proof();
    const create = jest.fn();
    const tx = {
      guestAssessmentClaim: { findUnique: async () => null },
      question: {
        findMany: async () => [
          { ...questions[0], content: 'Changed' },
          questions[1],
        ],
      },
      attempt: { create },
    };
    const repository = new GuestAssessmentRepository({
      ...tx,
      $transaction: async (fn) => fn(tx),
    } as any);
    await expect(repository.claim(receipt, outcome, 71)).rejects.toThrow(
      'The question bank changed.',
    );
    await expect(repository.lookup(receipt.id, 72)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
