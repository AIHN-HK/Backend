import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { UpdatePriorityDto } from './dto/updateDto';
import { recordAdminAudit } from '../../core/database/admin-audit';

@Injectable()
export class PriorityRepository {
  constructor(private readonly prisma: PrismaService) {}
  async getPriorities() {
    return this.prisma.priority.findMany();
  }
  async updatePriorities(data: UpdatePriorityDto, actorId?: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.priority.findMany();
        const next = rows.map((row) =>
          row.id === data.id ? { ...row, priority: data.priority } : row,
        );
        if (
          next.length !== 6 ||
          new Set(next.map((row) => row.priority)).size !== 6 ||
          next.some((row) => row.priority < 1 || row.priority > 6)
        ) {
          throw new BadRequestException(
            'Use /admin/priorities to reorder all six groups together.',
          );
        }
        const result = await tx.priority.update({
          where: { id: data.id },
          data: { priority: data.priority },
        });
        await recordAdminAudit(
          tx,
          actorId,
          'Priority',
          'updated',
          String(data.id),
          rows.find((row) => row.id === data.id),
          result,
        );
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
