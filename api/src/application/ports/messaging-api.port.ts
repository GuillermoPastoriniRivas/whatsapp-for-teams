import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

export interface TemplateSendComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url' | 'copy_code';
  index?: number;
  parameters: Array<{
    type: 'text' | 'image' | 'video' | 'document' | 'payload' | 'coupon_code';
    /** Required by Meta for named (non-positional) template parameters. */
    parameter_name?: string;
    text?: string;
    payload?: string;
    coupon_code?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string };
  }>;
}

export interface TemplateSendPayload {
  name: string;
  language: string;
  components?: TemplateSendComponent[];
}

export interface SendMessageParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
  to: string;
  type: string;
  body?: string;
  mediaUrl?: string;
  template?: TemplateSendPayload;
}

export interface SendMessageResult {
  waMessageId: string;
}

export interface TypingIndicatorParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
  to: string;
}

export interface MessagingApiPort {
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  sendTypingIndicator(params: TypingIndicatorParams): Promise<void>;
}
