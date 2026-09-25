import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUserToProfileDto } from './user.mapper';
import { RedisService } from 'src/core/redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly redisService: RedisService,
  ) {}

  async findById(id: number) {
    const user = await this.redisService.getOrSet(
      `user:${id}`,
      600,
      async () => {
        const u = await this.usersRepository.findById(id);

        if (!u) {
          throw new NotFoundException('User not found');
        }
        return u;
      },
    );
    return mapUserToProfileDto(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.usersRepository.update(id, updateUserDto);
      await this.redisService.setEx(
        `user:${id}`,
        300,
        JSON.stringify(updatedUser),
      );

      return mapUserToProfileDto(updatedUser);
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
