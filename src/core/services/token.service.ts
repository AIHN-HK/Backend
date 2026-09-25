import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from '../types/token.payload';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configModule: ConfigService,
  ) {}

  signAccessToken(payload: { userId: number }) {
    return this.jwtService.signAsync(payload as TokenPayload, {
      secret: this.configModule.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configModule.get<string>('JWT_ACCESS_EXPIRATION') as any,
      algorithm: 'HS256',
    });
  }
  signRefreshToken(payload: { userId: number }) {
    return this.jwtService.signAsync(payload as TokenPayload, {
      secret: this.configModule.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configModule.get<string>('JWT_REFRESH_EXPIRATION') as any,
      algorithm: 'HS256',
    });
  }
}
