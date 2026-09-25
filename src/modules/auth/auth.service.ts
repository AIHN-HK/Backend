import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthRepository } from './auth.repository';
import { UsersRepository } from '../users/users.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { HashingService } from 'src/core/services/hash.service';
import { TokenService } from 'src/core/services/token.service';
import { OtpService } from '../otp/otp.service';
import { OtpType } from 'src/core/types/otp.type';
import { ResetPasswordDto } from './dto/reset_password.dto';
import { MailService } from 'src/core/services/mail_service';
// import { RegisterLockService } from './register-lock.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly hashService: HashingService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    // private readonly registerLockService: RegisterLockService,
  ) {}
  async sendRegisterOtp(email: string) {
    const existingUser = await this.usersRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
    await this.otpService.deleteExistingOtps(email, OtpType.REGISTER);
    const otp = await this.otpService.createOtpCode({
      email,
      type: OtpType.REGISTER,
    });
    await this.mailService.sendOtp(email, otp);
    return 'success';
  }
  async sendForgotPasswordOtp(email: string) {
    const existingUser = await this.usersRepository.findByEmail(email);
    if (!existingUser) {
      throw new ConflictException('Email does not exist');
    }
    await this.otpService.deleteExistingOtps(email, OtpType.FORGOT_PASSWORD);
    const otp = await this.otpService.createOtpCode({
      email,
      type: OtpType.FORGOT_PASSWORD,
    });
    await this.mailService.sendOtp(email, otp);
    return otp;
  }
  async verifyOtpForgetPassword(email: string, otp: string) {
    const valid = await this.otpService.verifyOtpCode({
      email,
      code: otp,
      type: OtpType.FORGOT_PASSWORD,
    });
    if (!valid) {
      throw new UnauthorizedException('Invalid OTP code');
    }
    return true;
  }
  async resetPassword(data: ResetPasswordDto) {
    const user = await this.usersRepository.findByEmail(data.email);

    if (!user) {
      throw new ConflictException('User not found');
    }
    const verify = await this.otpService.checkVerifyOtp({
      email: data.email,
      code: data.otp,
      type: OtpType.FORGOT_PASSWORD,
    });

    if (!verify) {
      throw new UnauthorizedException('Invalid OTP code');
    }
    const hashedPassword = await this.hashService.hash(data.newPassword);

    const updated = await this.usersRepository.updatePassword(
      user.id,
      hashedPassword,
    );
    return updated;
  }
  // async register(registerDto: RegisterDto) {
  //   // return this.registerLockService.withEmailLock(registerDto.email, () =>
  //   //   this.registerCore(registerDto),
  //   // );
  //   return this.register(registerDto);
  // }

  async register(registerDto: RegisterDto) {
    const [valid, existingUser] = await Promise.all([
      this.otpService.verifyOtpCode({
        email: registerDto.email,
        code: registerDto.otpCode,
        type: OtpType.REGISTER,
      }),
      this.usersRepository.findByEmail(registerDto.email),
    ]);

    if (!valid) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await this.hashService.hash(registerDto.password);

    const user = await this.usersRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      fullname: registerDto.fullname,
      yob: new Date(registerDto.yob),
      phone: registerDto.phone,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }

    const isPasswordValid = await this.hashService.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string, userId: number) {
    const storedToken = await this.authRepository.findRefreshToken(
      refreshToken,
      userId,
    );

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = storedToken.user;
    if (!user) throw new UnauthorizedException('User not found');

    await this.authRepository.deleteRefreshToken(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return { ...tokens };
  }

  async logout(id: number) {
    await this.authRepository.deleteRefreshToken(id);
  }

  private async generateTokens(userId: number, email: string, role: string) {
    const payload = { userId: userId, email, role: role };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ]);

    const refreshExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
    );
    const expiresAt = this.calculateExpirationDate(refreshExpiration);

    // await Promise.all([
    //   this.authRepository.deleteRefreshToken(userId),
    //   this.authRepository.createRefreshToken({
    //     // Thêm token mới tinh này vào
    //     token: refreshToken,
    //     userId,
    //     expiresAt,
    //   }),
    // ]);
    await this.authRepository.TransactionRefreshToken(userId, {
      token: refreshToken,
      expiresAt,
    });
    return {
      accessToken,
      refreshToken,
    };
  }

  private calculateExpirationDate(expiration: string): Date {
    const now = new Date();
    const match = expiration.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        throw new Error('Invalid expiration unit');
    }
  }
}
