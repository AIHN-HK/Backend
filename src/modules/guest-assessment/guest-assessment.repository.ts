import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../core/database/prisma.service';
import type {
  GuestOutcome,
  GuestQuestion,
  GuestReceipt,
} from './guest-assessment.types';

const selection = {
  id: true,
  content: true,
  type: true,
  dimension: true,
} as const;
const fingerprint = (
  questions: {
    id: number;
    content: string;
    type: string;
    dimension: string | null;
  }[],
) => JSON.stringify([...questions].sort((a, b) => a.id - b.id));

@Injectable()
export class GuestAssessmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return this.prisma.$transaction(
      [
        this.prisma.question.findMany({
          select: selection,
          orderBy: { id: 'asc' },
        }),
        this.prisma.priority.findMany({
          select: { type: true, priority: true },
          orderBy: { priority: 'asc' },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async lookup(id: string, userId: number) {
    const claim = await this.prisma.guestAssessmentClaim.findUnique({
      where: { id },
    });
    if (!claim || claim.userId !== userId)
      throw new NotFoundException('No saved result for this account.');
    return { attemptId: claim.attemptId };
  }

  async claim(receipt: GuestReceipt, outcome: GuestOutcome, userId: number) {
    const digest = createHash('sha256')
      .update(
        JSON.stringify([
          receipt.questions,
          receipt.priorities,
          receipt.answers,
        ]),
      )
      .digest('hex');
    const confirmed = (saved: {
      userId: number;
      digest: string;
      attemptId: number;
    }) => {
      if (saved.userId !== userId || saved.digest !== digest)
        throw new ConflictException(
          'This guest test has already been saved with another account or answers.',
        );
      return { attemptId: saved.attemptId };
    };
    const saved = await this.prisma.guestAssessmentClaim.findUnique({
      where: { id: receipt.id },
    });
    if (saved) return confirmed(saved);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.guestAssessmentClaim.findUnique({
            where: { id: receipt.id },
          });
          if (existing) return confirmed(existing);
          const current = await tx.question.findMany({
            select: selection,
            orderBy: { id: 'asc' },
          });
          if (fingerprint(current) !== fingerprint(receipt.questions))
            throw new ConflictException({
              code: 'QUESTION_BANK_CHANGED',
              message:
                'The question bank changed. Keep your guest result and explicitly take a new test.',
            });
          const result = {
            scoreR: outcome.scores.R,
            scoreI: outcome.scores.I,
            scoreA: outcome.scores.A,
            scoreS: outcome.scores.S,
            scoreE: outcome.scores.E,
            scoreC: outcome.scores.C,
            topCode: outcome.topCode,
          };
          const byId = new Map<number, GuestQuestion>(
            receipt.questions.map((question) => [question.id, question]),
          );
          const attempt = await tx.attempt.create({
            data: {
              userId,
              totalQuestions: receipt.questions.length,
              finishAt: new Date(receipt.completedAt),
              answers: {
                create: receipt.answers.map((answer) => ({
                  questionId: answer.questionId,
                  answerValue: answer.check ? 1 : 0,
                })),
              },
              result: { create: result },
              snapshots: {
                create: {
                  snapshot: {
                    result,
                    questions: receipt.answers.map((answer) => ({
                      ...byId.get(answer.questionId),
                      answerValue: answer.check ? 1 : 0,
                    })),
                    source: 'guest-assessment-v1',
                    priorities: receipt.priorities,
                  } as Prisma.InputJsonValue,
                },
              },
              guestClaim: {
                create: {
                  id: receipt.id,
                  digest,
                  user: { connect: { id: userId } },
                },
              },
            },
            select: { id: true },
          });
          return { attemptId: attempt.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error.code === 'P2002' || error.code === 'P2034') {
        const winner = await this.prisma.guestAssessmentClaim.findUnique({
          where: { id: receipt.id },
        });
        if (winner) return confirmed(winner);
        throw new ConflictException(
          'Import is being processed or the question bank changed. Check the saved result before retrying.',
        );
      }
      throw error;
    }
  }
}
