import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import { MessagingApiPort, SendMessageParams, SendMessageResult, TypingIndicatorParams } from '../../application/ports/messaging-api.port.js';
import { MetaCloudApiService } from './meta-cloud-api.service.js';
import { TwilioWhatsAppService } from './twilio-whatsapp.service.js';
import { KapsoWhatsAppService } from './kapso-whatsapp.service.js';

@Injectable()
export class MessagingApiStrategyService implements MessagingApiPort {
  constructor(
    private readonly metaService: MetaCloudApiService,
    private readonly twilioService: TwilioWhatsAppService,
    private readonly kapsoService: KapsoWhatsAppService,
  ) {}

  async sendTypingIndicator(params: TypingIndicatorParams): Promise<void> {
    switch (params.provider) {
      case MessagingProvider.META:
        return this.metaService.sendTypingIndicator(params);

      case MessagingProvider.KAPSO:
        return this.kapsoService.sendTypingIndicator(params);

      default:
        // No-op for providers that don't support typing indicators
        return;
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    switch (params.provider) {
      case MessagingProvider.META:
        return this.metaService.sendMessage(params);

      case MessagingProvider.TWILIO:
        return this.twilioService.sendMessage(params);

      case MessagingProvider.KAPSO:
        return this.kapsoService.sendMessage(params);

      case MessagingProvider.DIALOG_360:
        throw new Error('360Dialog provider not yet implemented');

      case MessagingProvider.DEMO:
        return { waMessageId: `demo-${randomUUID()}` };

      default:
        throw new Error(`Unknown messaging provider: ${params.provider}`);
    }
  }
}
