import { DeveloperEventType } from '../enums/developer-event-type.enum.js';

/**
 * Endpoint HTTP de un desarrollador suscripto a eventos de la plataforma.
 * Cada entrega se firma con `secret` (HMAC SHA-256) para que el receptor
 * pueda verificar el origen.
 */
export class WebhookEndpoint {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly url: string,
    public readonly description: string | null,
    /** Secreto de firma, formato "whsec_..."; se muestra en la UI del tenant */
    public readonly secret: string,
    public readonly events: DeveloperEventType[],
    public readonly active: boolean,
    public readonly createdAt: Date,
  ) {}
}
