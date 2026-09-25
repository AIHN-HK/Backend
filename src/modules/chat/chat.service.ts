import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from 'src/core/database/prisma.service';
import { ClientSendMessage } from './chat.types';
import { AiService } from './ai.service';
import { ResultService } from '../result/result.service';
import { Logger } from '@nestjs/common';
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private resultService: ResultService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async saveUserMessage(dto: ClientSendMessage) {
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
  async stopGeneration(sessionId: number) {
    this.aiService.stopGeneration(sessionId);
  }
  async handleUserMessageStream(
    sessionId: number,
    content: string,
    profile_json: any,
    test_json: any,
    onToken: (token: string) => void,
    onEnd: () => void,
  ) {
    await this.prisma.chatMessage.create({
      data: { sessionId, content, role: 'user' },
    });
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        attempt: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    const cacheKey = `user-context-${session.attempt.userId}`;
    let cachedContext: any = await this.cacheManager.get(cacheKey);

    let basic_info, test_json_context;

    if (cachedContext) {
        this.logger.log(`Using cached context for user ${session.attempt.userId}`);
        basic_info = cachedContext.basic_info;
        test_json_context = cachedContext.test_json;
    } else {
        this.logger.log(`Fetching and caching context for user ${session.attempt.userId}`);
        const [result, user] = await Promise.all([
            this.prisma.result.findUnique({
                where: { attemptId: session.attemptId },
            }),
            this.prisma.user.findUnique({
                where: { id: session.attempt.userId },
            }),
        ]);

        if (!result) {
            throw new Error('Attempt has no result');
        }

        test_json_context = await this.resultService.getResultRanking(
            result.attemptId,
            session.attempt.userId,
        );

        basic_info = {
            full_name: user.fullname,
            age: new Date().getFullYear() - Number(user.yob),
            address: user.address,
            status: 'STUDENT',
        };

        // Cache for 1 hour (3600 seconds)
        await this.cacheManager.set(cacheKey, {
            basic_info,
            test_json: test_json_context
        }, 3600000); // cache-manager-ioredis usually uses ms or s depending on version, checking standard v2/v3 is often ms.
    }

    test_json = test_json_context;

    const history = await this.prisma.$transaction(async (tx) => {
      const messages = await tx.chatMessage.findMany({
        where: {
          sessionId,
          checkpoint: 0,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
        },
      });

      await tx.chatMessage.updateMany({
        where: {
          sessionId,
          checkpoint: 0,
        },
        data: {
          checkpoint: 1,
        },
      });

      return messages;
    });
    profile_json = {
      form_date: new Date().toISOString().slice(0, 10),
      basic_info,
      self_understanding: {
        hobbies: [],
        strengths: [],
        favorite_subjects: [],
        experience: null,
      },
      career_orientation: {
        has_chosen: false,
        considering_careers: null,
        target_schools: [],
        important_factors: [],
      },
      family_info: {
        father_job: null,
        mother_job: null,
        family_expectations: null,
        has_guidance: false,
        guidance_content: null,
      },
    };
    await this.prisma.chatSession.updateMany({
      where: {
        id: sessionId,
        title: 'Cuộc trò chuyện mới',
      },
      data: {
        title: content.slice(0, 50),
      },
    });

    return new Promise<void>((resolve, reject) => {
      let fullAnswer = '';

      this.aiService.streamAsk({
        sessionId,
        message: content,
        profile_json,
        test_json,
        history,
        onToken: (token) => {
          fullAnswer += token;
          onToken(token);
        },
        onEnd: async () => {
          try {
            await this.prisma.chatMessage.create({
              data: {
                sessionId,
                role: 'assistant',
                content: fullAnswer,
              },
            });
          } catch (err) {
            this.logger.error('Save assistant message error', err);
          }

          onEnd();
          resolve();
        },

        onError: (err) => {
          this.logger.error('AI error', err);
          reject(new Error(err));
        },
      });
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
}
