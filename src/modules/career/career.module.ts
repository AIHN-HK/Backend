import { Module } from '@nestjs/common';
import {
  CareerController,
  PersonalCareerController,
  AdminCareerController,
} from './career.controller';
import { CareerRepository } from './career.repository';
import { CareerService } from './career.service';
@Module({
  controllers: [
    CareerController,
    PersonalCareerController,
    AdminCareerController,
  ],
  providers: [CareerRepository, CareerService],
  exports: [CareerService],
})
export class CareerModule {}
