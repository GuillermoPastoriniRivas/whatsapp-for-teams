import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import { MessagingApiPort, ReadReceiptParams, SendMessageParams, SendMessageResult } from '../../application/ports/messaging-api.port.js';
import { MetaCloudApiService } from './meta-cloud-api.service.js';
import { RecipientNotReachableError } from '../../domain/errors/domain-errors.js';

@Injectable()
export class MessagingApiStrategyService implements MessagingApiPort {
  constructor(private readonly metaService: MetaCloudApiService) {}

  async markAsRead(params: ReadReceiptParams): Promise<void> {
    if (params.provider === MessagingProvider.META) {
      return this.metaService.markAsRead(params);
    }
    // El tenant demo no tiene API atrás: no hay a quién avisarle.
    return;
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    if (!params.to && !params.recipient) {
      throw new RecipientNotReachableError('The contact has neither a phone number nor a business-scoped user ID.');
    }

    switch (params.provider) {
      case MessagingProvider.META:
        return this.metaService.sendMessage(params);

      case MessagingProvider.DEMO:
        return { waMessageId: `demo-${randomUUID()}` };

      default:
        throw new Error(`Unknown messaging provider: ${params.provider}`);
    }
  }
}
