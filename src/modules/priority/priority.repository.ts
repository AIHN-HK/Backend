import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { UpdatePriorityDto } from './dto/updateDto';

@Injectable()
export class PriorityRepository {
  constructor(private readonly prisma: PrismaService) {}
  async getPriorities() {
    return this.prisma.priority.findMany();
  }
  async updatePriorities(data: UpdatePriorityDto) {
    return this.prisma.priority.update({
      where: { id: data.id },
      data: { priority: data.priority },
    });
  }
}
