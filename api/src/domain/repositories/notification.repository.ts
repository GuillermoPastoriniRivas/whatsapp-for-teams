import { Notification } from '../entities/notification.entity.js';
import { NotificationStatus } from '../enums/notification-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export interface NotificationFilters {
  tenantId: string;
  status?: NotificationStatus;
  templateId?: string;
  /** Límite inferior de `createdAt`. */
  from?: Date;
  /** Límite superior de `createdAt`. */
  to?: Date;
  page: number;
  limit: number;
}

/**
 * Datos que se completan cuando el mensaje sale hacia el proveedor. En sandbox
 * también se completan, pero con un wamid simulado.
 */
export interface NotificationSentPatch {
  messageId: string | null;
  waMessageId: string | null;
  contactId: string | null;
  conversationId: string | null;
  sentAt: Date;
}

export interface NotificationStatusTimestamps {
  queuedAt?: Date | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureReason?: string | null;
}

export interface NotificationRepository {
  /**
   * Guarda la notificación. El `id` es el público (`ntf_...`): la base guarda
   * su propio `_id` y el público es lo que se ve y lo que se busca.
   *
   * Puede lanzar un error de clave duplicada si otra request ganó la carrera
   * de idempotencia; el caso de uso lo traduce a la notificación existente.
   */
  create(notification: Notification): Promise<Notification>;

  /** Busca por id público (`ntf_...`). Uso interno (jobs y webhooks). */
  findById(id: string): Promise<Notification | null>;
  /** Busca por id público dentro del tenant. Es lo que usa la API. */
  findByTenantAndId(tenantId: string, id: string): Promise<Notification | null>;

  /**
   * Busca por clave de idempotencia. El sandbox forma parte de la clave: un
   * pedido de prueba y uno real con el mismo texto no se pisan.
   */
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
    sandbox: boolean,
  ): Promise<Notification | null>;

  findByFilters(filters: NotificationFilters): Promise<PaginatedResult<Notification>>;

  /** Busca la notificación que salió con este wamid (webhooks de Meta). */
  findByWaMessageId(waMessageId: string): Promise<Notification | null>;

  /**
   * Avanza el estado. Sólo aplica si el estado actual está entre los que
   * admiten la transición: los webhooks llegan desordenados y un `sent` tardío
   * no puede degradar un `read`. Devuelve null si no aplicaba o no existe.
   */
  updateStatus(
    id: string,
    status: NotificationStatus,
    timestamps?: NotificationStatusTimestamps,
  ): Promise<Notification | null>;

  /** Completa los ids del mensaje y la deja `sent`. */
  markSent(id: string, patch: NotificationSentPatch): Promise<Notification | null>;

  /**
   * Cancela una notificación agendada. Sólo aplica si está `scheduled`: si ya
   * salió, devuelve null y el caso de uso responde NOTIFICATION_NOT_CANCELABLE.
   */
  cancel(tenantId: string, id: string): Promise<Notification | null>;
}
