export interface InboundMessageInput {
  phoneNumberId: string;
  waMessageId: string;
  from: string;
  contactName: string;
  profilePicUrl?: string;
  messageType: string;
  body?: string;
  mediaUrl?: string;
  mimeType?: string;
  timestamp: Date;
  /** Id del botón/fila elegido (interactivos) o payload de quick-reply de plantilla */
  interactiveReplyId?: string;
  /** waMessageId del mensaje al que responde (context.id) */
  contextWaMessageId?: string;
}
