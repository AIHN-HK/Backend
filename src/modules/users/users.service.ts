import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUserToProfileDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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
      return mapUserToProfileDto(user);
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      throw error;
    }
  }
}
