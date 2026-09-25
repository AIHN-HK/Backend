import { Module } from '@nestjs/common';
import { PriorityController } from './priority.controller';
import { PriorityService } from './priority.service';
import { PriorityRepository } from './priority.repository';

@Module({
  controllers: [PriorityController],
  exports: [PriorityRepository, PriorityService],
  providers: [PriorityService, PriorityRepository],
})
export class PriorityModule {}
