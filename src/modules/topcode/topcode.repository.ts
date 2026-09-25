import { Injectable } from '@nestjs/common';
import { UpdateTopcodeBodyDto } from './dto/update.dto';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class TopcodeRepository {
  constructor(private readonly prismaService: PrismaService) {}
  async updateTopcode(data: UpdateTopcodeBodyDto) {
    return this.prismaService.topCode.update({
      where: { code: data.code },
      data: {
        title: data.title,
        personality: data.personality,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        careers: data.careers,
      },
    });
  }
  async findMany(codes: string[]) {
    return this.prismaService.topCode.findMany({
      where: {
        code: { in: codes },
      },
    });
  }
  async findHollandFirst(params: { condition: string }) {
    return this.prismaService.hollandCase.findFirst({
      where: { condition: params.condition },
      select: {
        code: true,
        title: true,
        description: true,
        personality: true,
        strengths: true,
        weaknesses: true,
        careers: true,
      },
    });
  }
  async findHollandByConditions(conditions: string[]) {
    return this.prismaService.hollandCase.findMany({
      where: { condition: { in: conditions } },
      select: {
        condition: true,
        code: true,
        title: true,
        description: true,
        personality: true,
        strengths: true,
        weaknesses: true,
        careers: true,
      },
    });
  }
}
