import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateResultDto, CreateSnapshotDto } from './dto/create_result.dto';
import { Prisma } from '@prisma/client';
import { RiasecCode } from 'src/core/constants/riasec.type';
type RiasecScore = Record<RiasecCode, number>;
@Injectable()
export class ResultRepository {
  constructor(private readonly prisma: PrismaService) {}
  async createResult(data: CreateResultDto) {
    return this.prisma.result.create({
      data: {
        attemptId: data.attemptId,
        scoreR: data.scores.R,
        scoreI: data.scores.I,
        scoreA: data.scores.A,
        scoreS: data.scores.S,
        scoreE: data.scores.E,
        scoreC: data.scores.C,
        topCode: data.topCode,
      },
    });
  }
  async findByAllAttemptId(attemptIds: number[]) {
    return this.prisma.result.findMany({
      where: {
        attemptId: { in: attemptIds },
      },
      include: {
        attempt: true,
      },
    });
  }
  async findByAttemptId(attemptId: number) {
    return this.prisma.result.findUnique({
      where: {
        attemptId: attemptId,
      },
      include: {
        attempt: true,
      },
    });
  }
  async snapshot(data: CreateSnapshotDto) {
    return this.prisma.snapShot.create({
      data: {
        attemptId: data.attemptId,
        snapshot: JSON.parse(JSON.stringify(data.snapshot)) as Prisma.JsonValue,
      },
    });
  }

  async findAnalyzeResult(topCode: string, scores: RiasecScore) {
    let analyzeResults;
    const code = topCode.split('');

    const highCount = (Object.values(scores) as number[]).filter(
      (v) => v >= 12 && v <= 18,
    ).length;

    const lowCount = (Object.values(scores) as number[]).filter(
      (v) => v >= 3 && v <= 6,
    ).length;

    const OPPOSITE_MAP: Record<RiasecCode, RiasecCode> = {
      R: 'S',
      S: 'R',
      I: 'E',
      E: 'I',
      A: 'C',
      C: 'A',
    };

    const top2 = (Object.entries(scores) as Array<[RiasecCode, number]>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([code]) => code);
    const OPPOSITE_PAIR_MAP: Record<string, string> = {
      R: 'R_S',
      S: 'R_S',
      I: 'I_E',
      E: 'I_E',
      A: 'A_C',
      C: 'A_C',
    };

    let oppositeCondition: string | null = null;

    if (top2.length === 2) {
      const [first, second] = top2;

      if (OPPOSITE_MAP[first] === second) {
        oppositeCondition = OPPOSITE_PAIR_MAP[first];
      }
    }

    if (highCount === 6) {
      const code1 = ['ALL_HIGH'];
      analyzeResults = await this.prisma.hollandCase.findMany({
        where: {
          code: {
            in: code1,
          },
        },
        select: {
          code: true,
          title: true,
          personality: true,
          strengths: true,
          weaknesses: true,
          careers: true,
          description: true,
        },
      });
    } else if (lowCount === 6) {
      const code1 = ['ALL_LOW'];
      analyzeResults = await this.prisma.hollandCase.findMany({
        where: {
          code: {
            in: code1,
          },
        },
        select: {
          code: true,
          title: true,
          personality: true,
          strengths: true,
          weaknesses: true,
          careers: true,
          description: true,
        },
      });
    } else if (oppositeCondition) {
      analyzeResults = await this.prisma.hollandCase.findMany({
        where: {
          condition: oppositeCondition,
        },
        select: {
          code: true,
          title: true,
          personality: true,
          strengths: true,
          weaknesses: true,
          careers: true,
          description: true,
        },
      });
    } else {
      analyzeResults = await this.prisma.topCode.findMany({
        where: {
          code: {
            in: code,
          },
        },
        select: {
          code: true,
          title: true,
          personality: true,
          strengths: true,
          weaknesses: true,
          careers: true,
          description: true,
        },
      });
    }

    return analyzeResults;
  }
  async findAnalyzeCode(topCode: string) {
    const analyzeResults = await this.prisma.topCode.findUnique({
      where: {
        code: topCode,
      },
      select: {
        code: true,
        title: true,
        personality: true,
        strengths: true,
        weaknesses: true,
        careers: true,
        description: true,
      },
    });
    return analyzeResults;
  }
  async getSnapshotByAttemptId(attemptId: number) {
    return this.prisma.snapShot.findUnique({
      where: {
        attemptId: attemptId,
      },
    });
  }
  async findAnalyzeCodes(codes: string[]) {
    return this.prisma.topCode.findMany({
      where: { code: { in: codes } },
      select: {
        code: true, // 👈 bắt buộc — dùng làm key cho Map lookup
        title: true,
        personality: true,
        strengths: true,
        weaknesses: true,
        careers: true,
        description: true,
      },
    });
  }
}
