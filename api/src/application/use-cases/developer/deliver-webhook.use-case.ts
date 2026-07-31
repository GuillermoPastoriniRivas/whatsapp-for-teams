import { Logger } from '@nestjs/common';
import { WebhookDeliveryRepository } from '../../../domain/repositories/webhook-delivery.repository.js';
import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { WebhookDeliveryStatus } from '../../../domain/entities/webhook-delivery.entity.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { FlowHttpPort } from '../../ports/flow-http.port.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { signWebhookPayload } from './developer-credentials.util.js';

export const DEVELOPER_WEBHOOK_DELIVER_JOB = 'developer.webhook-deliver';

/** Total de intentos por entrega (1 inicial + reintentos con backoff). */
const MAX_ATTEMPTS = 6;
/** Espera antes de cada reintento, indexada por intento fallido (1-based). */
const RETRY_BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY_CHARS = 500;

/**
 * Ejecuta UN intento de entrega de un webhook: firma el payload, hace el POST
 * (con el cliente HTTP con guard SSRF) y decide éxito, reintento o fallo
 * definitivo. El reintento se agenda como un job futuro sobre la misma
 * entrega, así el log del desarrollador refleja cada intento.
 */
export class DeliverWebhookUseCase {
  private readonly logger = new Logger(DeliverWebhookUseCase.name);

  constructor(
    private readonly deliveryRepo: WebhookDeliveryRepository,
    private readonly endpointRepo: WebhookEndpointRepository,
    private readonly http: FlowHttpPort,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery || delivery.status === WebhookDeliveryStatus.SUCCESS) return;

    const endpoint = await this.endpointRepo.findById(delivery.endpointId);
    if (!endpoint) {
      await this.deliveryRepo.update(deliveryId, {
        status: WebhookDeliveryStatus.FAILED,
        lastError: 'endpoint_deleted',
        lastAttemptAt: new Date(),
        nextRetryAt: null,
      });
      return;
    }

    // Un endpoint pausado no recibe eventos; el ping de prueba sí pasa para
    // poder verificar la integración antes de activarlo.
    if (!endpoint.active && delivery.eventType !== DeveloperEventType.PING) {
      await this.deliveryRepo.update(deliveryId, {
        status: WebhookDeliveryStatus.FAILED,
        lastError: 'endpoint_inactive',
        lastAttemptAt: new Date(),
        nextRetryAt: null,
      });
      return;
    }

    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(endpoint.secret, timestamp, body);
    const attempt = delivery.attempts + 1;

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let lastError: string | null = null;
    let success = false;

    try {
      const response = await this.http.request({
        method: 'POST',
        url: endpoint.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AsisChat-Webhooks/1.0',
          'X-Asis-Event': delivery.eventType,
          'X-Asis-Event-Id': delivery.eventId,
          'X-Asis-Delivery-Id': delivery.id,
          'X-Asis-Signature': `t=${timestamp},v1=${signature}`,
        },
        body,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      responseStatus = response.status;
      responseBody = this.truncateBody(response.body);
      success = response.status >= 200 && response.status < 300;
      if (!success) lastError = `HTTP ${response.status}`;
    } catch (error: any) {
      lastError = String(error?.message ?? error).slice(0, 300);
    }

    if (success) {
      await this.deliveryRepo.update(deliveryId, {
        status: WebhookDeliveryStatus.SUCCESS,
        attempts: attempt,
        responseStatus,
        responseBody,
        lastError: null,
        lastAttemptAt: new Date(),
        nextRetryAt: null,
      });
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      const delayMs = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
      const nextRetryAt = new Date(Date.now() + delayMs);
      await this.deliveryRepo.update(deliveryId, {
        status: WebhookDeliveryStatus.PENDING,
        attempts: attempt,
        responseStatus,
        responseBody,
        lastError,
        lastAttemptAt: new Date(),
        nextRetryAt,
      });
      await this.jobQueue.schedule(DEVELOPER_WEBHOOK_DELIVER_JOB, { deliveryId }, nextRetryAt);
      this.logger.debug(`Webhook delivery ${deliveryId} failed (attempt ${attempt}/${MAX_ATTEMPTS}), retry at ${nextRetryAt.toISOString()}`);
      return;
    }

    await this.deliveryRepo.update(deliveryId, {
      status: WebhookDeliveryStatus.FAILED,
      attempts: attempt,
      responseStatus,
      responseBody,
      lastError,
      lastAttemptAt: new Date(),
      nextRetryAt: null,
    });
    this.logger.warn(`Webhook delivery ${deliveryId} to ${endpoint.url} exhausted ${MAX_ATTEMPTS} attempts`);
  }

  private truncateBody(body: unknown): string | null {
    if (body === null || body === undefined) return null;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return text.slice(0, MAX_RESPONSE_BODY_CHARS);
  }
}
