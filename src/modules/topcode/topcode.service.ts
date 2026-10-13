import { Injectable } from '@nestjs/common';
import { TopcodeRepository } from './topcode.repository';
import { UpdateTopcodeBodyDto } from './dto/update.dto';
import { RedisService } from 'src/core/redis/redis.service';

@Injectable()
export class TopcodeService {
  constructor(
    private readonly topcodeRepository: TopcodeRepository,
    private readonly redisService: RedisService,
  ) {}
  async updateTopcode(data: UpdateTopcodeBodyDto, actorId?: number) {
    const result = await this.topcodeRepository.updateTopcode(data, actorId);
    await this.redisService.delByPattern('topcode:*').catch(() => undefined);
    return result;
  }
}
