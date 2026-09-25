import { Module } from '@nestjs/common';
import { TestSessionService } from './test-session.service';
import { SessionRepository } from './test-session.repository';
import { QuestionModule } from '../question/question.module';
import { TopcodeModule } from '../topcode/topcode.module';
import { AttemptModule } from '../attempt/attempt.module';
import { ResultModule } from '../result/result.module';

@Module({
  providers: [TestSessionService, SessionRepository],
  exports: [TestSessionService],
  imports: [QuestionModule, AttemptModule, TopcodeModule, ResultModule],
})
export class TestSessionModule {}
