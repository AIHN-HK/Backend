import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScoreCalculatorService } from '../assessment';
import { ResultModule } from '../result';
import { GuestAssessmentController } from './guest-assessment.controller';
import { GuestAssessmentRepository } from './guest-assessment.repository';
import { GuestAssessmentService } from './guest-assessment.service';

@Module({
  imports: [JwtModule.register({}), ResultModule],
  controllers: [GuestAssessmentController],
  providers: [
    GuestAssessmentService,
    GuestAssessmentRepository,
    ScoreCalculatorService,
  ],
})
export class GuestAssessmentModule {}
