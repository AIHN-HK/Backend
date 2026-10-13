import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ChatService } from './chat.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ChatTurnService } from './chat-turn.service';
import { AiStreamError, chatFailure } from './chat.errors';
import { ChatJobData, ChatEndEvent, isChatJob } from './chat.contracts';

@Processor('ai-chat-queue')
export class ChatProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(ChatProcessor.name);
  private readonly active = new Set<AbortController>();
  constructor(
    private readonly chatService: ChatService,
    private readonly eventEmitter: EventEmitter2,
    private readonly turns: ChatTurnService,
  ) {}

  @Process({ name: 'process-ask', concurrency: 10 })
  async handleAskJob(job: Job<ChatJobData>) {
    if (!isChatJob(job.data)) throw new Error('INVALID_CHAT_JOB');
    const { sessionId, content, turnId, userId } = job.data;
    const controller = new AbortController();
    this.active.add(controller);
    let checking = false;
    const monitor = setInterval(async () => {
      if (checking || controller.signal.aborted) return;
      checking = true;
      try {
        if (!(await this.turns.isCurrent(sessionId, turnId))) {
          controller.abort();
        } else if (!(await this.turns.renew(sessionId, turnId))) {
          controller.abort(
            new AiStreamError('CHAT_LEASE_LOST', 'Turn ownership was lost.'),
          );
        }
      } catch {
        controller.abort(
          new AiStreamError(
            'CHAT_QUEUE_UNAVAILABLE',
            'Turn coordination is unavailable.',
          ),
        );
      } finally {
        checking = false;
      }
    }, 500);
    let status: 'completed' | 'cancelled' | 'failed' = 'failed';
    let failure: unknown;
    try {
      if (!(await this.turns.isCurrent(sessionId, turnId))) {
        status = 'cancelled';
      } else {
        status = await this.chatService.handleUserMessageStream({
          sessionId,
          content,
          turnId,
          userId,
          signal: controller.signal,
          onToken: (token) => {
            if (!controller.signal.aborted)
              this.eventEmitter.emit('chat.token', {
                sessionId,
                turnId,
                token,
              });
          },
          onEnd: () => {},
        });
        if (controller.signal.reason instanceof AiStreamError)
          throw controller.signal.reason;
      }
    } catch (error) {
      failure = error;
      status = 'failed';
      this.logger.error(
        JSON.stringify({
          event: 'chat.turn.failed',
          sessionId,
          turnId,
          code: chatFailure(error).code,
        }),
      );
    } finally {
      clearInterval(monitor);
      this.active.delete(controller);
      await this.turns.release(sessionId, turnId).catch(() => {
        this.logger.warn('Turn release failed; lease expiry will recover it.');
      });
      const end: ChatEndEvent =
        status === 'failed'
          ? { sessionId, turnId, status, ...chatFailure(failure) }
          : { sessionId, turnId, status };
      this.eventEmitter.emit('chat.end', end);
    }
    if (status === 'failed') throw new Error(chatFailure(failure).code);
  }

  onModuleDestroy() {
    for (const controller of this.active) controller.abort();
  }
}
