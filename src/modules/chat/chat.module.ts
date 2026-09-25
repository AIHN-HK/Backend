import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaService } from 'src/core/database/prisma.service';
import { AiService } from './ai.service';
import { ChatController } from './chat.controller';
import { ResultModule } from '../result/result.module';
import { AuthModule } from '../auth/auth.module';
import { BullModule } from '@nestjs/bull';
import { ChatProcessor } from './chat.processor';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    PrismaService,
    AiService,
    ChatProcessor,
  ],
  imports: [
    ResultModule,
    AuthModule,
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    }),
    BullModule.registerQueue({
      name: 'ai-chat-queue',
    }),
    EventEmitterModule.forRoot(),
  ],
})
export class ChatModule {}
