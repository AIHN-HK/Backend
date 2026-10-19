import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import {
  AiStreamOutcome,
  ChatTurnInput,
  ChatMessageInput,
} from './chat.contracts';
import { ChatRepository } from './chat.repository';
import { ChatContextBuilder } from './chat-context.builder';
@Injectable()
export class ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly aiService: AiService,
    private readonly context: ChatContextBuilder,
  ) {}
  saveUserMessage(input: ChatMessageInput) {
    return this.repository.saveUserMessage(input);
  }
  saveQuestion(sessionId: number, content: string) {
    return this.repository.saveQuestion(sessionId, content);
  }
  createSession(socketId: string, userId: number, attemptId: number) {
    return this.repository.createSession(socketId, userId, attemptId);
  }
  createSessionChat(userId: number, attemptId: number) {
    return this.repository.createSessionChat(userId, attemptId);
  }
  closeSession(sessionId: number) {
    return this.repository.closeSession(sessionId);
  }
  async stopGeneration(sessionId: number, turnId?: string) {
    this.aiService.stopGeneration(sessionId, turnId);
  }
  async handleUserMessageStream(
    input: ChatTurnInput,
  ): Promise<AiStreamOutcome> {
    const { sessionId, content, userId, turnId, signal, onToken, onEnd } =
      input;
    const session = await this.assertSessionOwner(sessionId, userId);
    if (signal?.aborted) return 'cancelled';
    const context = await this.context.build(session);
    await this.repository.saveUserMessage({ sessionId, content });
    const history = await this.context.pendingHistory(sessionId);
    await this.repository.renameNewSession(sessionId, content);
    let fullAnswer = '';
    const outcome = await this.aiService.streamAsk({
      sessionId,
      turnId,
      signal,
      message: content,
      ...context,
      history,
      onToken: (token) => {
        fullAnswer += token;
        onToken(token);
      },
    });
    if (outcome === 'cancelled' || signal?.aborted) return 'cancelled';
    await this.repository.completeTurn(
      sessionId,
      fullAnswer,
      history.map((message) => message.id),
    );
    onEnd();
    return 'completed';
  }
  getSessionsChatByUser(userId: number) {
    return this.repository.getSessionsChatByUser(userId);
  }
  async assertSessionOwner(sessionId: number, userId: number) {
    if (!Number.isSafeInteger(userId) || userId <= 0)
      throw new UnauthorizedException();
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0)
      throw new ForbiddenException();
    const session = await this.repository.findSession(sessionId);
    if (!session || session.userId !== userId)
      throw new ForbiddenException('Session does not belong to you');
    return session;
  }
  async getMessage(sessionId: number, userId: number) {
    await this.assertSessionOwner(sessionId, userId);
    return this.repository.getMessage(sessionId);
  }
}
