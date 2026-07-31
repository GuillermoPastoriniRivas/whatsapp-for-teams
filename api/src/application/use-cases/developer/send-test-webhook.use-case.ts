import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { WebhookDeliveryRepository } from '../../../domain/repositories/webhook-delivery.repository.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, WebhookEndpointNotFoundError } from '../../../domain/errors/domain-errors.js';
import { generateEventId } from './developer-credentials.util.js';
import { DEVELOPER_WEBHOOK_DELIVER_JOB } from './deliver-webhook.use-case.js';

/**
 * Envía un evento `ping` a un endpoint concreto, sin importar su suscripción
 * ni si está activo: es la forma de probar la integración end-to-end.
 */
export class SendTestWebhookUseCase {
  constructor(
    private readonly endpointRepo: WebhookEndpointRepository,
    private readonly deliveryRepo: WebhookDeliveryRepository,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(tenantId: string, endpointId: string): Promise<Result<{ deliveryId: string }, DomainError>> {
    const endpoint = await this.endpointRepo.findById(endpointId);
    if (!endpoint || endpoint.tenantId !== tenantId) {
      return err(new WebhookEndpointNotFoundError());
    }

    const eventId = generateEventId();
    const delivery = await this.deliveryRepo.create({
      tenantId,
      endpointId,
      eventId,
      eventType: DeveloperEventType.PING,
      payload: {
        id: eventId,
        type: DeveloperEventType.PING,
        createdAt: new Date().toISOString(),
        data: {
          message: 'Prueba de webhook de Asis Chat. Si recibiste esto, tu endpoint funciona.',
          endpointId,
        },
      },
    });
    await this.jobQueue.enqueue(DEVELOPER_WEBHOOK_DELIVER_JOB, { deliveryId: delivery.id });

    return ok({ deliveryId: delivery.id });
  }
}
