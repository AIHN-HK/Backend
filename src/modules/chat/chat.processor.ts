import {
  Process,
  Processor,
  OnQueueActive,
  OnQueueError,
  OnQueueCompleted,
} from '@nestjs/bull';
import { Job } from 'bull';
import { ChatService } from './chat.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@Processor('ai-chat-queue')
export class ChatProcessor {
  private readonly logger = new Logger(ChatProcessor.name);
  @OnQueueError()
  onError(error: Error) {
    this.logger.error(
      `[REDIS ERROR] Lỗi kết nối hoặc lỗi Queue: ${error.message}`,
    );
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `[REDIS OK] Đang bắt đầu xử lý Job ID ${job.id} cho Session ${job.data.sessionId}...`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(
      `[REDIS OK] Đã xử lý xong Job ID ${job.id} cho Session ${job.data.sessionId}`,
    );
  }
  constructor(
    private readonly chatService: ChatService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process({ name: 'process-ask', concurrency: 10 })
  async handleAskJob(job: Job) {
    const { sessionId, content, basic_info, profile_json } = job.data;

    try {
      await this.chatService.handleUserMessageStream(
        sessionId,
        content,
        profile_json,
        basic_info,
        (token) => {
          this.eventEmitter.emit('chat.token', { sessionId, token });
        },
        () => {
          this.eventEmitter.emit('chat.end', { sessionId });
        },
      );
    } catch (error) {
      this.logger.error(
        `Error processing AI job for session ${sessionId}`,
        error,
      );
      this.eventEmitter.emit('chat.end', { sessionId });
    }
  }
}
