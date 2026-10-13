import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { ChatController } from './chat.controller';
import { ResultModule } from '../result/result.module';
import { AuthModule } from '../auth/auth.module';
import { BullModule } from '@nestjs/bull';
import { ChatProcessor } from './chat.processor';
import { ChatTurnService } from './chat-turn.service';

@Module({
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    ChatTurnService,
    AiService,
    ChatProcessor,
  ],
  imports: [
    ResultModule,
    AuthModule,
    BullModule.registerQueue({
      name: 'ai-chat-queue',
      // A crashed worker may already have contacted AI; never replay that turn.
      settings: { maxStalledCount: 0 },
    }),
  ],
})
export class ChatModule {}
