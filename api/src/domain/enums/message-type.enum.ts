export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  TEMPLATE = 'template',
  INTERACTIVE = 'interactive',
  /** Tarjeta de contacto. La manda el usuario al tocar `REQUEST_CONTACT_INFO`. */
  CONTACTS = 'contacts',
  /**
   * Reacción con emoji a otro mensaje. El emoji va en `body` y el mensaje al
   * que apunta en `contextWaMessageId` — Meta lo manda en `reaction.message_id`,
   * no en el `context` habitual.
   */
  REACTION = 'reaction',
}
