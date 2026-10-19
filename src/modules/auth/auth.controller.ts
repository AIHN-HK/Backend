import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
// import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../core/decorators/public.decorator';

import { CurrentUser } from 'src/core/decorators/current-user.decorator';
import { SendOtpDto, VerifyOtpDto } from './dto/send-otp';

import { OtpThrottlerGuard } from 'src/core/guards/otp-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { ResetPasswordDto } from './dto/reset_password.dto';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';
import { Roles } from 'src/core/decorators/roles.decorator';
import { UserRole } from 'src/core/types/user.type';
import { RefreshJwtGuard } from 'src/core/guards/refresh-token.guard';
import { LoginConcurrencyGuard } from '../../core/guards/login-concurrency.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @UseGuards(OtpThrottlerGuard)
  @ResponseMessage('OTP_Register sent successfully')
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  @Post('/register/send-otp')
  async sendRegisterOtp(@Body() data: SendOtpDto) {
    return this.authService.sendRegisterOtp(data.email);
  }
  @Public()
  @ResponseMessage('User registered successfully')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @UseGuards(LoginConcurrencyGuard)
  @ResponseMessage('User logged in successfully')
  async login(@Body() loginDto: LoginDto) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(loginDto);

    return { user, accessToken, refreshToken };
  }
  @Public()
  @ResponseMessage('OTP_Forgot password sent successfully')
  @Post('/forgot-password/send-otp')
  @UseGuards(OtpThrottlerGuard)
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  async sendForgotPasswordOtp(@Body() data: SendOtpDto) {
    return this.authService.sendForgotPasswordOtp(data.email);
  }
  @Public()
  @ResponseMessage('Password reset successfully')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('/reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
  @Public()
  @ResponseMessage('OTP_Register resent successfully')
  @UseGuards(OtpThrottlerGuard)
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @Post('/register/resend-otp')
  async resendRegisterOtp(@Body() data: SendOtpDto) {
    return this.authService.sendRegisterOtp(data.email);
  }
  @Public()
  @ResponseMessage('OTP_Forgot password resent successfully')
  @UseGuards(OtpThrottlerGuard)
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @Post('/forgot-password/resend-otp')
  async resendForgotPasswordOtp(@Body() data: SendOtpDto) {
    return this.authService.sendForgotPasswordOtp(data.email);
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('/verify-forget-password-otp')
  @ResponseMessage('OTP verified successfully')
  async verifyOtp(@Body() data: VerifyOtpDto) {
    return this.authService.verifyOtpForgetPassword(data.email, data.otp);
  }
  @Public()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(RefreshJwtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser('refreshToken') RefreshToken: string,
    @CurrentUser('id') userId: number,
  ) {
    const { accessToken, refreshToken } = await this.authService.refreshTokens(
      RefreshToken,
      userId,
    );

    return { accessToken, refreshToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 204, description: 'User successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async logout(@CurrentUser() user) {
    await this.authService.logout(user.id);

    // revoke refresh token trong DB
    return { message: 'Logged out' };
  }
  @Post('test-authorization')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Test user authorization' })
  @ApiResponse({ status: 204, description: 'User successfully authorized' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @Roles(UserRole.USER)
  async testAuthorization(@CurrentUser() user) {
    return user;
  }
}
