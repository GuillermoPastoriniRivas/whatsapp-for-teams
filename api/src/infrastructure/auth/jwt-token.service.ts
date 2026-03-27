import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenProviderPort, TokenPayload } from '../../application/ports/token-provider.port.js';

@Injectable()
export class JwtTokenService implements TokenProviderPort {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.refreshSecret = configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-change-me');
    this.refreshExpiresIn = configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  signAccess(payload: TokenPayload): string {
    return this.jwtService.sign({ ...payload });
  }

  signRefresh(payload: TokenPayload): string {
    return this.jwtService.sign({ ...payload }, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    } as JwtSignOptions);
  }

  verifyAccess(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token);
  }

  verifyRefresh(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token, {
      secret: this.refreshSecret,
    });
  }
}
