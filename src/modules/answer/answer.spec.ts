import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnswerService } from './answer.service';
import { AnswerRepository } from './answer.repository';
import { SubmitAnswerDtoV2 } from './dto/create_answer.dto';
import { ScoreCalculatorService } from '../assessment/domain/score-calculator.service';

describe('binary submission contract', () => {
  const priorities = ['R', 'I', 'A', 'S', 'E', 'C'].map((type, index) => ({
    type,
    priority: index + 1,
  }));
  function setup(owner = true) {
    const write = jest.fn(async (data: any) => data);
    const service = new AnswerService(
      { submitAnswerTransaction: write } as any,
      {
        findQuestionsByIdsDetailed: async () => [
          { id: 1, type: 'R', content: 'R fixture', dimension: 'PERSONA' },
          { id: 2, type: 'I', content: 'I fixture', dimension: 'INTEREST' },
        ],
      } as any,
      {
        findByIdAndUser: async () =>
          owner ? { totalQuestions: 2, finishAt: null } : null,
      } as any,
      new ScoreCalculatorService(),
      { getPriorities: async () => priorities } as any,
      { withAttemptLock: async (_id, callback) => callback() } as any,
    );
    return { service, write };
  }
  it('scores only selected answers and includes the matching durable snapshot', async () => {
    const { service, write } = setup();
    const result = await service.createAnswerV2(
      {
        attemptId: 1,
        answers: [
          { questionId: 1, check: true },
          { questionId: 2, check: false },
        ],
      },
      9,
    );
    expect(result.score).toEqual({ R: 1, I: 0, A: 0, S: 0, E: 0, C: 0 });
    expect(
      write.mock.calls[0][0].snapshot.questions.map(
        (question) => question.answerValue,
      ),
    ).toEqual([1, 0]);
    expect(write.mock.calls[0][0].userId).toBe(9);
  });
  it('routes legacy 0/1 through the same binary implementation', async () => {
    const { service } = setup();
    const result = await service.createAnswer(
      {
        attemptId: 1,
        answers: [
          { questionId: 1, answerValue: 1 },
          { questionId: 2, answerValue: 0 },
        ],
      },
      9,
    );
    expect(result.score.I).toBe(0);
    await expect(
      service.createAnswer(
        { attemptId: 1, answers: [{ questionId: 1, answerValue: 5 }] },
        9,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('denies ownership before any write', async () => {
    const { service, write } = setup(false);
    await expect(
      service.createAnswerV2(
        { attemptId: 1, answers: [{ questionId: 1, check: true }] },
        8,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['false', 'true', 0, 1, null])(
    'rejects nonboolean check %p instead of coercing it',
    async (check) => {
      const dto = plainToInstance(SubmitAnswerDtoV2, {
        attemptId: 1,
        answers: [{ questionId: 1, check }],
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
  it('accepts an actual false without changing its value', async () => {
    const dto = plainToInstance(SubmitAnswerDtoV2, {
      attemptId: 1,
      answers: [{ questionId: 1, check: false }],
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.answers[0].check).toBe(false);
  });
});

describe('atomic submission persistence', () => {
  function database(failSnapshot = false) {
    let state = {
      completed: false,
      answers: [],
      results: [],
      snapshots: [],
    } as any;
    let tail = Promise.resolve();
    const prisma = {
      $transaction: (callback) => {
        const run = tail.then(async () => {
          const next = structuredClone(state);
          const tx = {
            attempt: {
              updateMany: async () => {
                if (next.completed) return { count: 0 };
                next.completed = true;
                return { count: 1 };
              },
            },
            answer: {
              createMany: async ({ data }) => next.answers.push(...data),
            },
            result: { create: async ({ data }) => next.results.push(data) },
            snapShot: {
              create: async ({ data }) => {
                if (failSnapshot) throw new Error('Snapshot failed');
                next.snapshots.push(data);
              },
            },
          };
          await callback(tx);
          state = next;
        });
        tail = run.then(
          () => {},
          () => {},
        );
        return run;
      },
    };
    return {
      repository: new AnswerRepository(prisma as any),
      state: () => state,
    };
  }
  const input: any = {
    attemptId: 1,
    userId: 9,
    completedAt: new Date(),
    answers: [{ attemptId: 1, questionId: 1, answerValue: 1 }],
    resultData: { attempt: { connect: { id: 1 } } },
    snapshot: { result: {}, questions: [] },
  };
  it('allows only one completion when submissions overlap', async () => {
    const fixture = database();
    const outcomes = await Promise.allSettled([
      fixture.repository.submitAnswerTransaction(input),
      fixture.repository.submitAnswerTransaction(input),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(fixture.state().answers).toHaveLength(1);
    expect(fixture.state().results).toHaveLength(1);
    expect(fixture.state().snapshots).toHaveLength(1);
  });
  it('rolls back answers, result and completion if snapshot fails', async () => {
    const fixture = database(true);
    await expect(
      fixture.repository.submitAnswerTransaction(input),
    ).rejects.toThrow('Snapshot failed');
    expect(fixture.state()).toEqual({
      completed: false,
      answers: [],
      results: [],
      snapshots: [],
    });
  });
});
