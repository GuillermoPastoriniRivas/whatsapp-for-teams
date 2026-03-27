import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

export interface SendMessageParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
  to: string;
  type: string;
  body?: string;
}

export interface SendMessageResult {
  waMessageId: string;
}

export interface MessagingApiPort {
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}
