import { Module } from '@nestjs/common';
import {
  CareerController,
  PersonalCareerController,
  AdminCareerController,
  CareerProgressController,
  AdminCareerAnalyticsController,
} from './career.controller';
import { CareerProgressRepository } from './career-progress.repository';
import { CareerProgressService } from './career-progress.service';
import { CareerRepository } from './career.repository';
import { CareerService } from './career.service';
@Module({
  controllers: [
    CareerController,
    PersonalCareerController,
    AdminCareerController,
    CareerProgressController,
    AdminCareerAnalyticsController,
  ],
  providers: [
    CareerRepository,
    CareerService,
    CareerProgressRepository,
    CareerProgressService,
  ],
  exports: [CareerService, CareerProgressService],
})
export class CareerModule {}
