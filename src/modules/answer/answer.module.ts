import { Module } from '@nestjs/common';
import { AnswerController } from './answer.controller';
import { AnswerService } from './answer.service';
import { AnswerRepository } from './answer.repository';

import { QuestionModule } from '../question';
import { AttemptModule } from '../attempt';
import { ResultModule } from '../result';
import { ScoreCalculatorService } from '../assessment';
import { PriorityModule } from '../priority';
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
