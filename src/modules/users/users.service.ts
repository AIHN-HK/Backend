import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { RedisService } from '../../core/redis/redis.service';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUserToProfileDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  async findById(id: number) {
    // Read authoritative data: cache fills racing with PATCH can restore stale profiles.
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return mapUserToProfileDto(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // Explicit allowlist also protects callers outside the HTTP validation boundary.
    const {
      fullname,
      phone,
      address,
      gender,
      class: schoolClass,
    } = updateUserDto;
    try {
      const user = await this.usersRepository.update(id, {
        fullname,
        phone,
        address,
        gender,
        class: schoolClass,
      });
      // AI context is read from DB now; failed legacy cleanup cannot undo PATCH.
      if (this.redisService) {
        await this.redisService
          .del(`user-context-${id}`)
          .catch(() => undefined);
        await this.redisService.del(`user:${id}`).catch(() => undefined);
      }
      return mapUserToProfileDto(user);
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      throw error;
    }
  }
}
