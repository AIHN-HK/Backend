import { Module } from '@nestjs/common';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { ResultRepository } from './result.repository';

import { AttemptModule } from '../attempt/attempt.module';
import { ScoreCalculatorService } from 'src/core/services/score-calculator.services';

@Module({
  controllers: [ResultController],
  providers: [ResultService, ResultRepository, ScoreCalculatorService],
  imports: [AttemptModule],
  exports: [ResultRepository, ResultService],
})
export class ResultModule {}
