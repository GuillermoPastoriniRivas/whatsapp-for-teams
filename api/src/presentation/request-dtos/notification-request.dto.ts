import { z } from 'zod';
import { HttpException } from '@nestjs/common';
import { NotificationStatus } from '../../domain/enums/notification-status.enum.js';
import { DomainError } from '../../domain/errors/domain-errors.js';

/**
 * Contrato HTTP de las notificaciones.
 *
 * Acá viven los schemas de entrada (zod), la forma de la respuesta que ve el
 * desarrollador en `/v1/notifications` y la que ve el equipo en el panel, y el
 * contrato de inyección con los casos de uso.
 *
 * Los casos de uso los escribe otra tarea en paralelo, así que no se importan:
 * se inyectan por token de DI y se tipan acá con las interfaces mínimas que
 * necesita la presentación.
 */

/**
 * Estados posibles de una notificación. Sale del enum del dominio
 * (`NotificationStatus`), así que la API y el dominio no se pueden
 * desincronizar.
 */
export const NOTIFICATION_STATUSES = Object.values(NotificationStatus);

/** Plantilla por id o por nombre + idioma. */
const TemplateRefSchema = z.object({
  name: z.string().min(1).max(120),
  language: z.string().min(2).max(10),
});

/**
 * `POST /v1/notifications`. La plantilla es obligatoria (por id o por
 * nombre+idioma): una notificación sin plantilla no tiene a quién mandarle
 * un mensaje de WhatsApp.
 */
export const CreateNotificationRequestSchema = z
  .object({
    /** Número destino en formato internacional (con o sin +). */
    to: z.string().min(8).max(20),
    templateId: z.string().min(1).max(64).optional(),
    template: TemplateRefSchema.optional(),
    /** Variables de la plantilla. Los números se guardan como texto. */
    variables: z.record(z.string(), z.union([z.string(), z.number()]).transform(String)).optional(),
    /** Programar el envío (ISO 8601). Si no viene, sale ahora. */
    sendAt: z.string().datetime({ offset: true }).optional(),
    /** Metadatos libres del desarrollador; se devuelven en el detalle. */
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Número emisor. Opcional si la cuenta tiene uno solo activo. */
    phoneNumberId: z.string().min(1).max(64).optional(),
  })
  .refine((data) => !!data.templateId || !!data.template, {
    message: 'Provide `templateId` or `template: { name, language }`',
    path: ['templateId'],
  })
  .refine((data) => JSON.stringify(data.metadata ?? {}).length <= 4000, {
    message: '`metadata` is too large (max 4000 characters)',
    path: ['metadata'],
  });

export type CreateNotificationRequestDto = z.infer<typeof CreateNotificationRequestSchema>;

/** Filtros de la lista de notificaciones, en la API pública y en el panel. */
export const NotificationQuerySchema = z.object({
  status: z.nativeEnum(NotificationStatus).optional(),
  templateId: z.string().min(1).max(64).optional(),
  /** Desde (inclusive), ISO 8601. */
  from: z.string().datetime({ offset: true }).optional(),
  /** Hasta (inclusive), ISO 8601. */
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type NotificationQueryDto = z.infer<typeof NotificationQuerySchema>;

/** Un paso del historial de la notificación. */
export interface NotificationTimelineEntry {
  status: string;
  at: string | null;
  detail?: string | null;
}

/**
 * Notificación como la devuelve el dominio. Los campos que todavía no
 * existen son opcionales para no romper la API si el núcleo los agrega
 * después.
 */
export interface NotificationRecord {
  id: string;
  status: string;
  to?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  variables?: Record<string, string> | null;
  sandbox?: boolean | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  sendAt?: Date | string | null;
  queuedAt?: Date | string | null;
  sentAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  readAt?: Date | string | null;
  failedAt?: Date | string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  timeline?: NotificationTimelineEntry[] | null;
}

/** Notificación como sale por la API (misma forma en público y panel). */
export interface NotificationView {
  id: string;
  status: string;
  to: string | null;
  templateId: string | null;
  templateName: string | null;
  sandbox: boolean;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  sendAt: string | null;
  queuedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  timeline: NotificationTimelineEntry[];
}

/** Errores del dominio y su código HTTP en esta superficie. */
export const NOTIFICATION_ERROR_STATUS: Record<string, number> = {
  INVALID_METADATA: 422,
  INVALID_SEND_AT: 422,
  NOTIFICATION_NOT_FOUND: 404,
  IDEMPOTENCY_KEY_REUSED: 409,
  NOTIFICATION_NOT_CANCELABLE: 409,
  NOTIFICATION_ALREADY_SENT: 409,
  TEMPLATE_NOT_FOUND: 422,
  TEMPLATE_NOT_APPROVED: 422,
  MISSING_TEMPLATE_VARIABLES: 422,
  INVALID_PHONE: 422,
  INVALID_RECIPIENT: 422,
  TEMPLATE_PHONE_MISMATCH: 422,
  PHONE_NUMBER_NOT_FOUND: 422,
  PHONE_NUMBER_AMBIGUOUS: 422,
  PHONE_NUMBER_INACTIVE: 422,
  MISSING_MESSAGE_CONTENT: 422,
  MARKETING_OPT_OUT: 422,
  AUTH_TEMPLATE_REQUIRES_PHONE: 422,
  FEATURE_NOT_IN_PLAN: 403,
};

export function throwNotificationError(error: DomainError): never {
  throw new HttpException(
    { code: error.code, message: error.message },
    NOTIFICATION_ERROR_STATUS[error.code] ?? 400,
  );
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Historial de la notificación, armado con las marcas de tiempo que trae el
 * dominio. Si el caso de uso ya devuelve un timeline, ese manda.
 */
export function buildTimeline(notification: NotificationRecord): NotificationTimelineEntry[] {
  const timeline: NotificationTimelineEntry[] = [];
  const add = (
    status: string,
    at: Date | string | null | undefined,
    detail?: string | null,
  ): void => {
    const moment = toIso(at);
    if (!moment) return;
    timeline.push({ status, at: moment, detail: detail ?? null });
  };

  add('scheduled', notification.createdAt);
  add('queued', notification.queuedAt);
  add('sent', notification.sentAt);
  add('delivered', notification.deliveredAt);
  add('read', notification.readAt);
  add('failed', notification.failedAt, notification.failureReason);
  if (notification.status === 'canceled') {
    add('canceled', notification.updatedAt ?? notification.createdAt);
  }
  return timeline;
}

/** Notificación lista para la respuesta. */
export function serializeNotification(notification: NotificationRecord): NotificationView {
  return {
    id: notification.id,
    status: notification.status,
    to: notification.to ?? null,
    templateId: notification.templateId ?? null,
    templateName: notification.templateName ?? null,
    sandbox: notification.sandbox === true,
    metadata: notification.metadata ?? {},
    createdAt: toIso(notification.createdAt),
    sendAt: toIso(notification.sendAt),
    queuedAt: toIso(notification.queuedAt),
    sentAt: toIso(notification.sentAt),
    deliveredAt: toIso(notification.deliveredAt),
    readAt: toIso(notification.readAt),
    failedAt: toIso(notification.failedAt),
    failureCode: notification.failureCode ?? null,
    failureReason: notification.failureReason ?? null,
    timeline: notification.timeline ?? buildTimeline(notification),
  };
}

/** El caso de uso puede devolver la notificación sola o envuelta. */
export function unwrapNotification(value: unknown): NotificationRecord {
  if (value && typeof value === 'object' && 'notification' in value) {
    return (value as { notification: NotificationRecord }).notification;
  }
  return value as NotificationRecord;
}

function isFailureResult(value: unknown): value is { ok: false; error: DomainError } {
  return (
    !!value &&
    typeof value === 'object' &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false
  );
}

function isSuccessResult(value: unknown): value is { ok: true; value: unknown } {
  return (
    !!value &&
    typeof value === 'object' &&
    'ok' in value &&
    (value as { ok: unknown }).ok === true
  );
}

/**
 * Desempaqueta el resultado de un caso de uso: espera la promesa y acepta el
 * sobre `Result` del dominio (ok/err), el valor directo y un `DomainError`
 * lanzado. Sin el `await` previo, el `ok` se chequeaba sobre la promesa y el
 * error terminaba convertido en un 500.
 */
export async function settle<T>(outcome: unknown): Promise<T> {
  let value: unknown;
  try {
    value = await outcome;
  } catch (error) {
    if (error instanceof DomainError) throwNotificationError(error);
    throw error;
  }

  if (isFailureResult(value)) throwNotificationError(value.error);
  if (isSuccessResult(value)) return value.value as T;
  return value as T;
}

/** Filtros que se le pasan al caso de uso de listado. */
export interface NotificationFilters {
  tenantId: string;
  status?: NotificationStatus;
  templateId?: string;
  /** ISO 8601; el helper los convierte a Date antes de llegar al caso de uso. */
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

/** Entrada del caso de uso de envío. */
export interface SendNotificationInput {
  tenantId: string;
  to: string;
  templateId?: string;
  template?: { name: string; language: string };
  variables?: Record<string, string>;
  sendAt?: string;
  metadata?: Record<string, unknown>;
  phoneNumberId?: string;
  idempotencyKey: string;
  sandbox?: boolean;
  createdByAgentId?: string | null;
}

/**
 * `SendNotificationUseCase.execute(input: SendNotificationInput)`.
 *
 * Se tipa con argumentos sueltos a propósito: el caso de uso se escribe en
 * paralelo y la presentación no se debe romper si cambia la forma.
 */
export interface SendNotificationUseCaseContract {
  execute(...args: unknown[]): Promise<unknown>;
}

/** `GetNotificationUseCase.execute(tenantId, id)`. */
export interface GetNotificationUseCaseContract {
  execute(...args: unknown[]): Promise<unknown>;
}

/** `ListNotificationsUseCase.execute(filters)`. */
export interface ListNotificationsUseCaseContract {
  execute(...args: unknown[]): Promise<unknown>;
}

/** `CancelNotificationUseCase.execute(tenantId, id)`. */
export interface CancelNotificationUseCaseContract {
  execute(...args: unknown[]): Promise<unknown>;
}

/**
 * Ejecuta un caso de uso que trabaja con una sola notificación.
 *
 * El contrato es siempre un objeto: decidir por `function.length` parecía
 * tolerante pero perdía datos (el `agentId` del panel) y escondía diferencias
 * de firma en vez de fallar temprano.
 */
export async function executeById<T>(
  useCase: { execute(...args: unknown[]): Promise<unknown> },
  tenantId: string,
  id: string,
  extra?: Record<string, unknown>,
): Promise<T> {
  return settle<T>(useCase.execute({ tenantId, id, ...(extra ?? {}) }));
}

/** Ejecuta el caso de uso de listado, convirtiendo los ISO a Date. */
export async function executeList(
  useCase: { execute(...args: unknown[]): Promise<unknown> },
  _tenantId: string,
  filters: NotificationFilters,
): Promise<unknown> {
  return settle<unknown>(
    useCase.execute({
      ...filters,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    }),
  );
}

/**
 * Normaliza la lista: el núcleo puede devolver `{ data, meta }` con el `meta`
 * de siempre; acá se completa con `page` y `limit` para que la API pública y
 * el panel devuelvan la misma forma.
 */
export function buildNotificationList(
  payload: unknown,
  page: number,
  limit: number,
): { data: NotificationView[]; meta: { page: number; limit: number; total: number; pages: number } } {
  const source = (payload ?? {}) as {
    data?: unknown[];
    meta?: { total?: number; pages?: number };
  };
  const rows = Array.isArray(source.data) ? source.data : [];
  const data = rows.map((row) => serializeNotification(unwrapNotification(row)));
  const total = typeof source.meta?.total === 'number' ? source.meta.total : data.length;
  const pages =
    typeof source.meta?.pages === 'number'
      ? source.meta.pages
      : Math.ceil(total / Math.max(1, limit));

  return { data, meta: { page, limit, total, pages } };
}
