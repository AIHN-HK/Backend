import { Injectable } from '@nestjs/common';
import { PriorityRepository } from './priority.repository';
import { UpdatePriorityDto } from './dto/updateDto';
import { RedisService } from 'src/core/redis/redis.service';

@Injectable()
export class PriorityService {
  constructor(
    private readonly priority: PriorityRepository,
    private readonly redisService: RedisService,
  ) {}
  async getPriorities() {
    return await this.priority.getPriorities();
  }
  async updatePriorities(data: UpdatePriorityDto, actorId?: number) {
    const result = await this.priority.updatePriorities(data, actorId);
    await this.redisService.del('priority:all').catch(() => undefined);
    return result;
  }
}
