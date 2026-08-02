export interface InboundMessageInput {
  phoneNumberId: string;
  waMessageId: string;
  from: string;
  contactName: string;
  profilePicUrl?: string;
  messageType: string;
  body?: string;
  /** URL pública del archivo. Solo Twilio la manda; Meta manda un id. */
  mediaUrl?: string;
  /** Id de media del proveedor. Con esto se baja el archivo (30 días de vida). */
  mediaId?: string;
  mimeType?: string;
  /** Nombre original con el que el contacto envió el documento. */
  mediaFilename?: string;
  /** Hash que reporta el proveedor, en hex. Sirve de verificación y de dedup. */
  mediaSha256?: string;
  timestamp: Date;
  /** Id del botón/fila elegido (interactivos) o payload de quick-reply de plantilla */
  interactiveReplyId?: string;
  /** waMessageId del mensaje al que responde (context.id) */
  contextWaMessageId?: string;
}
