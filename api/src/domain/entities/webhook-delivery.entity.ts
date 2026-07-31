import { DeveloperEventType } from '../enums/developer-event-type.enum.js';

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Un intento de entrega de un evento a un endpoint. Sirve de log visible para
 * el desarrollador y de unidad de reintento (el job de la cola referencia el
 * id de la entrega).
 */
export class WebhookDelivery {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly endpointId: string,
    /** Id único del evento (evt_...); igual para todas las entregas del mismo evento */
    public readonly eventId: string,
    public readonly eventType: DeveloperEventType,
    public readonly payload: Record<string, unknown>,
    public readonly status: WebhookDeliveryStatus,
    public readonly attempts: number,
    public readonly responseStatus: number | null,
    /** Cuerpo de respuesta truncado, para diagnóstico */
    public readonly responseBody: string | null,
    /** Error de red/timeout del último intento, si lo hubo */
    public readonly lastError: string | null,
    public readonly lastAttemptAt: Date | null,
    public readonly nextRetryAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
