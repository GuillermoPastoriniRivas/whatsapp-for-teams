import { Message } from '../entities/message.entity.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';
import { MessageLocation } from '../value-objects/message-location.js';
import { MessageReferral } from '../value-objects/message-referral.js';
import { PaginatedResult } from './conversation.repository.js';

export type UpsertMessageInput = Omit<
  Message,
  'id' | 'campaignId' | 'waErrorCode' | 'waErrorMessage' | 'interactiveReplyId' | 'contextWaMessageId' | 'interactivePayload' | 'mediaAssetId' | 'location' | 'senderKind' | 'deliveredAt' | 'failedAt' | 'referral'
> & {
  /** Quién lo escribió. Omitido = desconocido (mensajes previos a ago-2026). */
  senderKind?: import('../entities/message.entity.js').MessageSenderKind | null;
  campaignId?: string | null;
  interactiveReplyId?: string | null;
  contextWaMessageId?: string | null;
  interactivePayload?: Record<string, unknown> | null;
  mediaAssetId?: string | null;
  location?: MessageLocation | null;
  referral?: MessageReferral | null;
};

export interface StatusUpdateOptions {
  /**
   * Cuándo lo dijo Meta, no cuándo lo procesamos: el job puede correr mucho
   * después y el sello de entrega es lo que después se convierte en plata.
   */
  occurredAt?: Date;
  error?: { code: string; message: string };
}

export interface MessageRepository {
  upsertByWaMessageId(message: UpsertMessageInput): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  attachMediaAsset(messageId: string, mediaAssetId: string): Promise<Message | null>;
  findByConversationId(conversationId: string, page: number, limit: number): Promise<PaginatedResult<Message>>;
  /**
   * Avanza el estado sin retroceder nunca y sella `deliveredAt` / `failedAt` una
   * sola vez. Los webhooks de Meta llegan desordenados y repetidos.
   */
  updateStatusByWaMessageId(
    waMessageId: string,
    waStatus: MessageWaStatus,
    options?: StatusUpdateOptions,
  ): Promise<Message | null>;
}
