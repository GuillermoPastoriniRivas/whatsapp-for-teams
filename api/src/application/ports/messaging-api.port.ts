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

export interface InteractiveSendPayload {
  kind: 'buttons' | 'list';
  body: string;
  footer?: string;
  /** kind 'buttons': 1–3 botones (title ≤ 20 chars) */
  buttons?: Array<{ id: string; title: string }>;
  /** kind 'list': texto del botón que abre la lista (≤ 20 chars) */
  buttonText?: string;
  /** kind 'list': 1–10 filas (title ≤ 24, description ≤ 72) */
  rows?: Array<{ id: string; title: string; description?: string }>;
}

export interface SendMessageParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
  to: string;
  type: string;
  body?: string;
  /**
   * URL pública para que Meta descargue el archivo. Solo para URLs externas
   * que ya tiene el tenant — nuestro propio media siempre viaja por `mediaId`.
   */
  mediaUrl?: string;
  /** Id de media del proveedor. Tiene prioridad sobre `mediaUrl`. */
  mediaId?: string;
  /** Solo documentos: nombre con el que el cliente ve/descarga el archivo */
  filename?: string;
  template?: TemplateSendPayload;
  interactive?: InteractiveSendPayload;
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
