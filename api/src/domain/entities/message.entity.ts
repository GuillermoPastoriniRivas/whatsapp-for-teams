import { MessageDirection } from '../enums/message-direction.enum.js';
import { MessageType } from '../enums/message-type.enum.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';

export class Message {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly direction: MessageDirection,
    public readonly messageType: MessageType,
    public readonly body: string | null,
    public readonly mediaUrl: string | null,
    public readonly mimeType: string | null,
    public readonly waMessageId: string,
    public readonly waStatus: MessageWaStatus,
    public readonly timestamp: Date,
    public readonly senderAgentId: string | null,
    public readonly senderAgentName: string | null,
    public readonly campaignId: string | null = null,
    public readonly waErrorCode: string | null = null,
    public readonly waErrorMessage: string | null = null,
    /** Id de la opción elegida en un mensaje interactivo (botón/fila) o payload de quick-reply de plantilla */
    public readonly interactiveReplyId: string | null = null,
    /** waMessageId del mensaje al que responde (context.id de Meta) */
    public readonly contextWaMessageId: string | null = null,
    /** Solo outbound interactivo: definición de botones/lista para render en el chat */
    public readonly interactivePayload: Record<string, unknown> | null = null,
  ) {}
}
