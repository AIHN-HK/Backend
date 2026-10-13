import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ClientSendMessage } from './chat.types';

import { ConflictException, Logger } from '@nestjs/common';
import { ChatTurnService } from './chat-turn.service';
import { PrismaService } from 'src/core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
import { allowedOrigins } from '../../core/config/cors.options';
@WebSocketGateway({
  cors: {
    origin: allowedOrigins(
      process.env.CORS_ORIGINS,
      process.env.NODE_ENV === 'production',
    ),
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  server: Server;
  constructor(
    private chatService: ChatService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    @InjectQueue('ai-chat-queue') private aiChatQueue: Queue,
    private readonly turns: ChatTurnService,
  ) {}
  private generatingMap = new Map<number, string>();
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const owner = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!owner) throw new Error('User not found');
      client.data.user = payload;
      const userId = payload.userId;

      const attempt = await this.prisma.attempt.findFirst({
        where: { userId, finishAt: { not: null }, result: { isNot: null } },
        orderBy: { createdAt: 'desc' },
      });

      if (!attempt) {
        this.logger.warn(
          `Connection rejected: No attempt found for user ${userId}`,
        );
        client.disconnect();
        return;
      }

      const session = await this.chatService.createSession(
        client.id,
        userId,
        attempt.id,
      );

      client.data.sessionId = session.id;
      client.join(`session-${session.id}`);
      client.emit('connected', {
        sessionId: session.id,
        userID: session.userId,
        attemptId: attempt.id,
        title: session.title,
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  // ============================================================
  // [DISABLED] Flow mới: tách create_session ra khỏi handleConnection
  // Bật lên khi FE sẵn sàng dùng event 'create_session' + 'session_ready'
  // ============================================================
  // @SubscribeMessage('create_session')
  // async handleCreateSession(
  //   @MessageBody() data: { sessionId?: number },
  //   @ConnectedSocket() client: Socket,
  // ) {
  //   const userId = client.data.userId;
  //   const attemptId = client.data.attemptId;
  //
  //   if (data?.sessionId) {
  //     const existing = await this.prisma.chatSession.findUnique({
  //       where: { id: data.sessionId },
  //     });
  //     if (existing && existing.userId === userId) {
  //       await this.prisma.chatSession.update({
  //         where: { id: existing.id },
  //         data: { socketId: client.id, status: 'ACTIVE' },
  //       });
  //       client.data.sessionId = existing.id;
  //       client.join(`session-${existing.id}`);
  //       client.emit('session_ready', {
  //         sessionId: existing.id,
  //         userID: existing.userId,
  //         attemptId: existing.attemptId,
  //         title: existing.title,
  //       });
  //       return;
  //     }
  //   }
  //
  //   const session = await this.chatService.createSession(
  //     client.id,
  //     userId,
  //     attemptId,
  //   );
  //   client.data.sessionId = session.id;
  //   client.join(`session-${session.id}`);
  //   client.emit('session_ready', {
  //     sessionId: session.id,
  //     userID: session.userId,
  //     attemptId: session.attemptId,
  //     title: session.title,
  //   });
  // }
  // ============================================================

  async handleDisconnect(client: Socket) {
    const sessionId = client.data.sessionId;

    if (!sessionId) {
      this.logger.warn(`Disconnect without sessionId, socket: ${client.id}`);
      return;
    }

    await this.chatService.closeSession(sessionId);
    this.logger.warn(`WS client disconnected: ${client.id}`);
  }

  private async authorizeSession(socket: Socket, sessionId: number) {
    try {
      const payload = this.jwtService.verify(socket.handshake.auth.token);
      if (payload.userId !== socket.data.user?.userId)
        throw new Error('Account changed');
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) throw new Error('User not found');
      await this.chatService.assertSessionOwner(sessionId, payload.userId);
      return true;
    } catch {
      socket.emit('error', {
        message: 'Session access denied or authentication expired',
      });
      return false;
    }
  }

  @SubscribeMessage('refresh_auth')
  async handleRefreshAuth(
    @MessageBody() data: { token: string },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const payload = this.jwtService.verify(data.token);
      if (payload.userId !== socket.data.user?.userId)
        throw new Error('Account changed');
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) throw new Error('User not found');
      socket.handshake.auth.token = data.token;
      socket.emit('auth_refreshed');
    } catch {
      socket.emit('error', { message: 'Authentication renewal rejected' });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() payload: ClientSendMessage,
    @ConnectedSocket() socket: Socket,
  ) {
    if (!(await this.authorizeSession(socket, payload.sessionId))) return;
    if (payload.sessionId && socket.data.sessionId !== payload.sessionId) {
      if (socket.data.sessionId)
        socket.leave(`session-${socket.data.sessionId}`);
      socket.join(`session-${payload.sessionId}`);
      socket.data.sessionId = payload.sessionId;
    }

    const message = await this.chatService.saveUserMessage(payload);

    this.server.to(`session-${message.sessionId}`).emit('new_message', {
      sessionId: message.sessionId,
      content: message.content,
      createdAt: message.createdAt,
    });
  }

  @SubscribeMessage('ask')
  async handleAsk(
    @MessageBody()
    data: {
      sessionId: number;
      content: string;
      basic_info?: unknown;
      profile_json?: unknown;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    if (!(await this.authorizeSession(socket, data?.sessionId))) return;
    if (
      typeof data.content !== 'string' ||
      !data.content.trim() ||
      data.content.length > 8000
    ) {
      socket.emit('error', {
        code: 'INVALID_CHAT_MESSAGE',
        message: 'Message must contain 1–8000 characters.',
      });
      return;
    }
    if (socket.data.sessionId !== data.sessionId) {
      if (socket.data.sessionId)
        socket.leave(`session-${socket.data.sessionId}`);
      socket.join(`session-${data.sessionId}`);
      socket.data.sessionId = data.sessionId;
    }
    let turnId: string;
    try {
      turnId = await this.turns.reserve(data.sessionId);
      this.generatingMap.set(data.sessionId, turnId);
      await this.aiChatQueue.add(
        'process-ask',
        {
          sessionId: data.sessionId,
          turnId,
          content: data.content,
          userId: socket.data.user.userId,
        },
        {
          jobId: turnId,
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      this.server.to(`session-${data.sessionId}`).emit('queue_joined', {
        sessionId: data.sessionId,
        turnId,
        message: 'Hệ thống đang xử lý yêu cầu, vui lòng chờ...',
      });
    } catch (error) {
      if (turnId) {
        await this.turns.release(data.sessionId, turnId).catch(() => undefined);
        if (this.generatingMap.get(data.sessionId) === turnId)
          this.generatingMap.delete(data.sessionId);
      }
      socket.emit('error', {
        code:
          error instanceof ConflictException
            ? 'CHAT_BUSY'
            : 'CHAT_QUEUE_UNAVAILABLE',
        message:
          error instanceof ConflictException
            ? 'Một lượt chat đang chờ hoặc đang chạy.'
            : 'Hàng đợi chat tạm thời không khả dụng.',
      });
    }
  }
  @OnEvent('chat.token')
  handleChatToken(payload: {
    sessionId: number;
    turnId: string;
    token: string;
  }) {
    if (this.generatingMap.get(payload.sessionId) !== payload.turnId) return;
    this.server.to(`session-${payload.sessionId}`).emit('answer_token', {
      sessionId: payload.sessionId,
      content: payload.token,
      turnId: payload.turnId,
    });
  }
  @OnEvent('chat.end')
  handleChatEnd(payload: {
    sessionId: number;
    turnId: string;
    status: string;
    code?: string;
    message?: string;
  }) {
    if (this.generatingMap.get(payload.sessionId) !== payload.turnId) return;
    this.generatingMap.delete(payload.sessionId);
    this.server.to(`session-${payload.sessionId}`).emit('answer_end', payload);
    if (payload.status === 'failed')
      this.server
        .to(`session-${payload.sessionId}`)
        .emit('answer_error', payload);
  }

  @SubscribeMessage('stop_generation')
  async handleStop(
    @MessageBody() data: { sessionId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    if (!(await this.authorizeSession(socket, data.sessionId))) return;
    try {
      const turnId = await this.turns.cancel(data.sessionId);
      if (!turnId) return;
      await this.chatService.stopGeneration(data.sessionId, turnId);
      const job = await this.aiChatQueue.getJob(turnId);
      if (!job || ['failed', 'completed'].includes(await job.getState())) {
        await this.turns.release(data.sessionId, turnId);
      }
      if (
        job &&
        ['waiting', 'delayed', 'paused'].includes(await job.getState())
      ) {
        try {
          await job.remove();
          await this.turns.release(data.sessionId, turnId);
        } catch {
          // A worker may have claimed the job; it will observe cancellation.
        }
      }
      if (this.generatingMap.get(data.sessionId) === turnId)
        this.generatingMap.delete(data.sessionId);
      this.server.to(`session-${data.sessionId}`).emit('generation_stopped', {
        sessionId: data.sessionId,
        turnId,
      });
    } catch {
      socket.emit('error', {
        code: 'CHAT_QUEUE_UNAVAILABLE',
        message:
          'Không thể xác nhận hủy lượt chat. Hãy kiểm tra lịch sử trước khi gửi lại.',
      });
    }
  }
}
