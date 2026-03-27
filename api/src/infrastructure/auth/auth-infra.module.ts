import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BcryptHasherService } from './bcrypt-hasher.service.js';
import { JwtTokenService } from './jwt-token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'secret-change-me'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as any },
      }),
    }),
  ],
  providers: [
    BcryptHasherService,
    JwtTokenService,
    { provide: 'PasswordHasherPort', useExisting: BcryptHasherService },
    { provide: 'TokenProviderPort', useExisting: JwtTokenService },
  ],
  exports: ['PasswordHasherPort', 'TokenProviderPort'],
})
export class AuthInfraModule {}
