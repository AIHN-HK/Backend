import { Module } from '@nestjs/common';
import { AnswerController } from './answer.controller';
import { AnswerService } from './answer.service';
import { AnswerRepository } from './answer.repository';

import { QuestionModule } from '../question/question.module';
import { AttemptModule } from '../attempt/attempt.module';
import { ResultModule } from '../result/result.module';
import { ScoreCalculatorService } from 'src/core/services/score-calculator.services';
import { PriorityModule } from '../priority/priority.module';
import { AnswerSubmitLockService } from './answer-submit-lock.service';

@Module({
  controllers: [AnswerController],
  providers: [
    AnswerService,
    AnswerRepository,
    ScoreCalculatorService,
    AnswerSubmitLockService,
  ],
  exports: [AnswerRepository],
  imports: [QuestionModule, AttemptModule, ResultModule, PriorityModule],
})
export class AnswerModule {}
