/**
 * Eventos que la plataforma publica hacia los webhooks de desarrolladores.
 * El valor es el `type` que viaja en el payload y el que se usa para
 * suscribir un endpoint. `ping` es solo para pruebas de conectividad y se
 * entrega siempre, sin importar la suscripción.
 */
export enum DeveloperEventType {
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_STATUS_UPDATED = 'message.status.updated',
  CONVERSATION_CREATED = 'conversation.created',
  CONVERSATION_ASSIGNED = 'conversation.assigned',
  PING = 'ping',
}

/** Eventos a los que un endpoint se puede suscribir (todos menos ping). */
export const SUBSCRIBABLE_DEVELOPER_EVENTS: DeveloperEventType[] = [
  DeveloperEventType.MESSAGE_RECEIVED,
  DeveloperEventType.MESSAGE_SENT,
  DeveloperEventType.MESSAGE_STATUS_UPDATED,
  DeveloperEventType.CONVERSATION_CREATED,
  DeveloperEventType.CONVERSATION_ASSIGNED,
];
