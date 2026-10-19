import { Injectable } from '@nestjs/common';
import { ChatSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { ChatMessageInput } from './chat.contracts';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}
  async saveUserMessage(dto: ChatMessageInput) {
    return await this.prisma.chatMessage.create({
      data: {
        sessionId: dto.sessionId,
        content: dto.content,
        role: 'user',
      },
    });
  }
  async saveQuestion(sessionId: number, content: string) {
    return await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });
  }
  async createSession(socketId: string, userId: number, attemptId: number) {
    const latestEmpty = await this.prisma.chatSession.findFirst({
      where: {
        userId,
        title: 'Cuộc trò chuyện mới',
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestEmpty) {
      const hasMessage = await this.prisma.chatMessage.findFirst({
        where: { sessionId: latestEmpty.id },
      });

      if (!hasMessage) {
        return this.prisma.chatSession.update({
          where: { id: latestEmpty.id },
          data: { socketId, attemptId },
        });
      }
    }

    return this.prisma.chatSession.create({
      data: {
        socketId,
        userId,
        attemptId,
        title: 'Cuộc trò chuyện mới',
        status: 'ACTIVE',
      },
    });
  }
  async createSessionChat(userId: number, attemptId: number) {
    const chatSession = await this.prisma.chatSession.create({
      data: {
        status: 'ACTIVE',
        title: 'Cuộc trò chuyện mới',
        userId,
        attemptId,
        socketId: '',
      },
    });

    return { sessionId: chatSession.id };
  }
  async closeSession(sessionId: number) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }
  async getSessionsChatByUser(userId: number) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });
  }
  async getMessage(sessionId: number) {
    return this.prisma.chatMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  findSession(sessionId: number) {
    return this.prisma.chatSession.findUnique({ where: { id: sessionId } });
  }
  findUser(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
  latestCompletedAttempt(userId: number) {
    return this.prisma.attempt.findFirst({
      where: { userId, finishAt: { not: null }, result: { isNot: null } },
      orderBy: { createdAt: 'desc' },
    });
  }
  readContextRecords(session: Pick<ChatSession, 'userId' | 'attemptId'>) {
    return Promise.all([
      this.prisma.result.findUnique({
        where: { attemptId: session.attemptId },
      }),
      this.findUser(session.userId),
    ]);
  }
  async pendingHistory(sessionId: number) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId, checkpoint: 0 },
      orderBy: { createdAt: 'asc' },
      take: 201,
      select: { id: true, role: true, content: true },
    });
  }
  renameNewSession(sessionId: number, content: string) {
    return this.prisma.chatSession.updateMany({
      where: { id: sessionId, title: 'Cuộc trò chuyện mới' },
      data: { title: content.slice(0, 50) },
    });
  }
  // Owns the transaction: assistant and exactly the sent pending IDs commit together.
  completeTurn(sessionId: number, content: string, sentIds: number[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.create({
        data: { sessionId, role: 'assistant', content },
      });
      await tx.chatMessage.updateMany({
        where: { sessionId, id: { in: sentIds }, checkpoint: 0 },
        data: { checkpoint: 1 },
      });
    });
  }
}
