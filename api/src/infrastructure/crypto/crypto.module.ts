import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlowSecretsService } from './flow-secrets.service.js';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: 'FlowSecretsPort', useClass: FlowSecretsService }],
  exports: ['FlowSecretsPort'],
})
export class CryptoModule {}
