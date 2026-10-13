import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { AttemptModule } from '../attempt';
import { TopcodeModule } from '../topcode';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository],
  imports: [AttemptModule, TopcodeModule],
})
export class UsersModule {}
