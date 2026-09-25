import { Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptRepository } from './attempt.repository';

@Module({
  providers: [AttemptService, AttemptRepository],
  exports: [AttemptRepository],
})
export class AttemptModule {}
