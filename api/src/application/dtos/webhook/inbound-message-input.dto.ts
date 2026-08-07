import type { MessageLocation } from '../../../domain/value-objects/message-location.js';

export interface InboundMessageInput {
  phoneNumberId: string;
  waMessageId: string;
  /**
   * Teléfono del remitente, en dígitos. **Opcional**: Meta lo omite para los
   * usuarios que solo comparten su username. Al menos uno entre `from` y
   * `bsuid` siempre viene.
   */
  from?: string;
  /** Business-Scoped User ID del remitente. */
  bsuid?: string;
  parentBsuid?: string;
  /** Username público del remitente, sin '@'. */
  username?: string;
  /**
   * Teléfono que el usuario acaba de compartir al tocar `REQUEST_CONTACT_INFO`.
   * Es la vía para recuperar el número de un contacto solo-BSUID.
   */
  sharedPhone?: string;
  contactName?: string;
  profilePicUrl?: string;
  messageType: string;
  body?: string;
  /** URL pública del archivo. Meta manda un id, no una URL: queda por si un
   * origen interno (simulador, demo) inyecta un mensaje ya resuelto. */
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
  /** Coordenadas de un mensaje `location`, ya normalizadas. */
  location?: MessageLocation | null;
}

/** Meta regeneró el BSUID de un usuario (cambió de teléfono). */
export interface UserIdUpdateInput {
  wabaId: string;
  previousBsuid: string;
  newBsuid: string;
  phone: string | null;
}
