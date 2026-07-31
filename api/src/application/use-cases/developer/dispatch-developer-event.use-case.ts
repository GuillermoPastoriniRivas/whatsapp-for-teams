import { Logger } from '@nestjs/common';
import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { WebhookDeliveryRepository } from '../../../domain/repositories/webhook-delivery.repository.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { generateEventId } from './developer-credentials.util.js';
import { DEVELOPER_WEBHOOK_DELIVER_JOB } from './deliver-webhook.use-case.js';

/**
 * Punto de salida de todos los eventos hacia desarrolladores: busca los
 * endpoints suscriptos del tenant, persiste una entrega por endpoint y la
 * encola. Implementa DeveloperEventsPort para que cualquier caso de uso emita
 * sin conocer la mecánica de entrega.
 */
export class DispatchDeveloperEventUseCase implements DeveloperEventsPort {
  private readonly logger = new Logger(DispatchDeveloperEventUseCase.name);

  constructor(
    private readonly endpointRepo: WebhookEndpointRepository,
    private readonly deliveryRepo: WebhookDeliveryRepository,
    private readonly jobQueue: JobQueuePort,
  ) {}

  emit(tenantId: string, type: DeveloperEventType, data: Record<string, unknown>): void {
    void this.dispatch(tenantId, type, data).catch((error: any) => {
      this.logger.error(`Failed to dispatch developer event ${type} for tenant ${tenantId}: ${error?.message}`);
    });
  }

  async dispatch(tenantId: string, type: DeveloperEventType, data: Record<string, unknown>): Promise<number> {
    const endpoints = await this.endpointRepo.findActiveByTenantAndEvent(tenantId, type);
    if (endpoints.length === 0) return 0;

    const eventId = generateEventId();
    const payload = {
      id: eventId,
      type,
      createdAt: new Date().toISOString(),
      data,
    };

    for (const endpoint of endpoints) {
      const delivery = await this.deliveryRepo.create({
        tenantId,
        endpointId: endpoint.id,
        eventId,
        eventType: type,
        payload,
      });
      await this.jobQueue.enqueue(DEVELOPER_WEBHOOK_DELIVER_JOB, { deliveryId: delivery.id });
    }

    return endpoints.length;
  }
}
