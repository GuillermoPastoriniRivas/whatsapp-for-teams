import { NotificationStatus } from '../enums/notification-status.enum.js';

/**
 * Notificación de la API de desarrolladores.
 *
 * Es un recurso propio, no una vista del mensaje: el desarrollador pide "mandá
 * esta plantilla a este número" y después quiere consultar el estado de eso sin
 * tener que entender conversaciones, WABAs ni la ventana de 24 horas. Por eso
 * tiene id público (`ntf_...`), estado propio y una línea de tiempo.
 *
 * El mensaje de WhatsApp que salió (si salió) queda referenciado en
 * `messageId`: es el detalle interno, no la identidad de la notificación.
 */
export class Notification {
  constructor(
    /** Id público de la notificación (`ntf_...`). Es lo que ve el desarrollador. */
    public readonly id: string,
    public readonly tenantId: string,
    /** Número de WhatsApp desde el que sale. Null si todavía no se resolvió. */
    public readonly phoneNumberId: string | null,
    public readonly contactId: string | null,
    public readonly conversationId: string | null,
    /** Id del `Message` interno que salió. Null mientras no salió. */
    public readonly messageId: string | null,
    /**
     * Id que devolvió el proveedor (wamid) o el simulado en sandbox. Permite
     * enganchar los webhooks de estado aunque el `Message` todavía no exista.
     */
    public readonly waMessageId: string | null,
    /** Destino en dígitos, tal como se pidió. */
    public readonly to: string | null,
    public readonly templateId: string | null,
    /** Nombre de la plantilla en Meta, para que el panel no dependa del id. */
    public readonly templateName: string | null,
    public readonly variables: Record<string, string>,
    public readonly status: NotificationStatus,
    /** Cuándo tiene que salir. Null = inmediata. */
    public readonly sendAt: Date | null,
    /** Cuándo pasó a la cola de salida. Null si todavía no se encoló. */
    public readonly queuedAt: Date | null,
    public readonly sentAt: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly readAt: Date | null,
    public readonly failedAt: Date | null,
    /** Código estable del fallo (mismo criterio que los `DomainError`). */
    public readonly failureCode: string | null,
    public readonly failureReason: string | null,
    /** JSON libre del desarrollador: correlación, orden, lo que quiera. */
    public readonly metadata: Record<string, unknown>,
    /** Clave de idempotencia del pedido. Null si el pedido no la trajo. */
    public readonly idempotencyKey: string | null,
    /** Hash del pedido: la misma key con otro body es un error, no un reenvío. */
    public readonly requestHash: string | null,
    /** True si es una simulación: no sale a Meta y no se contabiliza. */
    public readonly sandbox: boolean,
    public readonly createdByAgentId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

/**
 * Desde qué estados se puede entrar a cada estado.
 *
 * El avance no retrocede: los webhooks de Meta llegan desordenados y un `sent`
 * tardío no puede degradar un `read` que ya se vio. `canceled` sólo sale de
 * `scheduled` (cancelar algo que ya salió es un error, no una transición), y
 * `read` se puede alcanzar desde `sent` porque un `read` implica entregado.
 */
const ALLOWED_SOURCES: Record<NotificationStatus, NotificationStatus[]> = {
  [NotificationStatus.SCHEDULED]: [],
  [NotificationStatus.QUEUED]: [NotificationStatus.SCHEDULED],
  [NotificationStatus.SENT]: [NotificationStatus.SCHEDULED, NotificationStatus.QUEUED],
  [NotificationStatus.DELIVERED]: [NotificationStatus.SENT],
  [NotificationStatus.READ]: [NotificationStatus.SENT, NotificationStatus.DELIVERED],
  [NotificationStatus.FAILED]: [
    NotificationStatus.SCHEDULED,
    NotificationStatus.QUEUED,
    NotificationStatus.SENT,
    NotificationStatus.DELIVERED,
  ],
  [NotificationStatus.CANCELED]: [NotificationStatus.SCHEDULED],
};

/** Estados desde los que se puede entrar a `target`. */
export function allowedNotificationSourceStatuses(target: NotificationStatus): NotificationStatus[] {
  return ALLOWED_SOURCES[target] ?? [];
}

/** Un estado contra el que no se puede volver: el final de la línea. */
export function isTerminalNotificationStatus(status: NotificationStatus): boolean {
  return status === NotificationStatus.FAILED || status === NotificationStatus.CANCELED;
}
