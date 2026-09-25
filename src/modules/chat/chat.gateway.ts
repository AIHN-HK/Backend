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

import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
@WebSocketGateway({
  cors: {
    origin: '*',
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
  ) {}
  private generatingMap = new Map<number, boolean>();
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      const userId = payload.userId;

      const attempt = await this.prisma.attempt.findFirst({
        where: { userId },
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

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() payload: ClientSendMessage,
    @ConnectedSocket() socket: Socket,
  ) {
    if (payload.sessionId && socket.data.sessionId !== payload.sessionId) {
      if (socket.data.sessionId) socket.leave(`session-${socket.data.sessionId}`);
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
      basic_info: any;
      profile_json: any;
      content: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    if (data.sessionId && socket.data.sessionId !== data.sessionId) {
      if (socket.data.sessionId) socket.leave(`session-${socket.data.sessionId}`);
      socket.join(`session-${data.sessionId}`);
      socket.data.sessionId = data.sessionId;
    }

    this.generatingMap.set(data.sessionId, true);

    await this.aiChatQueue.add('process-ask', {
      sessionId: data.sessionId,
      basic_info: data.basic_info,
      profile_json: data.profile_json,
      content: data.content,
    });

    this.server.to(`session-${data.sessionId}`).emit('queue_joined', {
      sessionId: data.sessionId,
      message: 'Hệ thống đang xử lý yêu cầu, vui lòng chờ...',
    });
    // this.chatService.handleUserMessageStream(
    //   data.sessionId,
    //   data.content,
    //   data.basic_info,
    //   data.profile_json,
    //   (token) => {
    //     if (!this.generatingMap.get(data.sessionId)) return;
    //     this.server.to(`session-${data.sessionId}`).emit('answer_token', {
    //       sessionId: data.sessionId,
    //       content: token,
    //     });
    //   },

    //   () => {
    //     this.generatingMap.set(data.sessionId, false);

    //     this.server.to(`session-${data.sessionId}`).emit('answer_end', {
    //       sessionId: data.sessionId,
    //     });
    //   },
    // );
  }
  @OnEvent('chat.token')
  handleChatToken(payload: { sessionId: number; token: string }) {
    if (!this.generatingMap.get(payload.sessionId)) return;
    this.server.to(`session-${payload.sessionId}`).emit('answer_token', {
      sessionId: payload.sessionId,
      content: payload.token,
    });
  }
  @OnEvent('chat.end')
  handleChatEnd(payload: { sessionId: number }) {
    this.generatingMap.set(payload.sessionId, false);
    this.server.to(`session-${payload.sessionId}`).emit('answer_end', {
      sessionId: payload.sessionId,
    });
  }

  @SubscribeMessage('stop_generation')
  handleStop(
    @MessageBody() data: { sessionId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    this.chatService.stopGeneration(data.sessionId);
    this.generatingMap.set(data.sessionId, false);
    this.server.to(`session-${data.sessionId}`).emit('generation_stopped', {
      sessionId: data.sessionId,
    });
  }
}
