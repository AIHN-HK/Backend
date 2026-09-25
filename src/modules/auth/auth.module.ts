import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { HashingService } from 'src/core/services/hash.service';
import { TokenService } from 'src/core/services/token.service';
import { OtpModule } from '../otp/otp.module';
import { MailService } from 'src/core/services/mail_service';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { RefreshJwtGuard } from 'src/core/guards/refresh-token.guard';
import { LoginConcurrencyGuard } from '../../core/guards/login-concurrency.guard';
import { RegisterLockService } from './register-lock.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION') as any,
        },
      }),
    }),

    UsersModule,
    OtpModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    HashingService,
    TokenService,
    MailService,
    RefreshStrategy,
    RefreshJwtGuard,
    LoginConcurrencyGuard,
    RegisterLockService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
