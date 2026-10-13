import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { ValidationPipe } from './core/pipes/validation.pipe';
// import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
// import { AuthModule } from './modules/auth/auth.module';
// import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { QuestionModule } from './modules/question/question.module';
import { AnswerModule } from './modules/answer/answer.module';
import { AttemptModule } from './modules/attempt/attempt.module';
import { TestSessionModule } from './modules/test-session/test-session.module';
import { ResultModule } from './modules/result/result.module';
import { ChatModule } from './modules/chat/chat.module';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { LoggingMiddleware } from './core/middleware/logging.middleware';
import { TopcodeModule } from './modules/topcode/topcode.module';
import { PriorityModule } from './modules/priority/priority.module';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { RolesGuard } from './core/guards/roles.guard';
import { RedisModule } from './core/redis/redis.module';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { redisOptions } from './core/config/redis.options';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AdminModule } from './modules/admin/admin.module';
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: seconds(60),
        limit: 1000,
      },
    ]),
    ConfigModule,
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AdminModule,
    // UsersModule,
    HealthModule,
    QuestionModule,
    AnswerModule,
    AttemptModule,
    TestSessionModule,
    ResultModule,
    ChatModule,
    TopcodeModule,
    PriorityModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ redis: redisOptions(config) }),
    }),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    { provide: APP_GUARD, useClass: RolesGuard },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
