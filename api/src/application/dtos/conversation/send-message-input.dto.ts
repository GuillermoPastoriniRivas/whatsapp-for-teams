import { MessageType } from '../../../domain/enums/message-type.enum.js';

export interface SendMessageInput {
  conversationId: string;
  agentId: string;
  tenantId: string;
  /** Texto del mensaje o caption del adjunto. */
  body: string;
  messageType?: MessageType;
  /** Archivo de la biblioteca o recién subido. Define el tipo del mensaje. */
  mediaAssetId?: string;
  /** Id **nuestro** del mensaje que se está citando al responder. */
  replyToMessageId?: string;
}
