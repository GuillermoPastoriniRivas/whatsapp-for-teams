import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import { MessagingApiPort, SendMessageParams, SendMessageResult } from '../../application/ports/messaging-api.port.js';
import { MetaCloudApiService } from './meta-cloud-api.service.js';

@Injectable()
export class MessagingApiStrategyService implements MessagingApiPort {
  constructor(
    private readonly metaService: MetaCloudApiService,
    // Future: private readonly twilioService: TwilioWhatsAppService,
    // Future: private readonly dialog360Service: Dialog360Service,
  ) {}

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    switch (params.provider) {
      case MessagingProvider.META:
        return this.metaService.sendMessage(params);

      case MessagingProvider.TWILIO:
        throw new Error('Twilio provider not yet implemented');

      case MessagingProvider.DIALOG_360:
        throw new Error('360Dialog provider not yet implemented');

      default:
        throw new Error(`Unknown messaging provider: ${params.provider}`);
    }
  }
}
