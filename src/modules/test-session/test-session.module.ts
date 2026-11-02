import { Module } from '@nestjs/common';
import { TestSessionService } from './test-session.service';
import { SessionRepository } from './test-session.repository';
import { QuestionModule } from '../question';
import { TopcodeModule } from '../topcode';
import { AttemptModule } from '../attempt';
import { ResultModule } from '../result';
import { TestSessionController } from './test-session.controller';

@Module({
  controllers: [TestSessionController],
  providers: [TestSessionService, SessionRepository],
  exports: [TestSessionService],
  imports: [QuestionModule, AttemptModule, TopcodeModule, ResultModule],
})
export class TestSessionModule {}
