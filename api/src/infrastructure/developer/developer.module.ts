import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DispatchDeveloperEventUseCase } from '../../application/use-cases/developer/dispatch-developer-event.use-case.js';
import type { WebhookEndpointRepository } from '../../domain/repositories/webhook-endpoint.repository.js';
import type { WebhookDeliveryRepository } from '../../domain/repositories/webhook-delivery.repository.js';
import type { JobQueuePort } from '../../application/ports/job-queue.port.js';

/**
 * Provee el puerto de eventos hacia desarrolladores. Vive en infraestructura
 * para que cualquier caso de uso lo reciba inyectado como 'DeveloperEventsPort'
 * sin conocer la mecánica de endpoints/colas.
 */
@Module({
  imports: [PersistenceModule, QueueModule],
  providers: [
    {
      provide: 'DeveloperEventsPort',
      useFactory: (endpointRepo: WebhookEndpointRepository, deliveryRepo: WebhookDeliveryRepository, jobQueue: JobQueuePort) =>
        new DispatchDeveloperEventUseCase(endpointRepo, deliveryRepo, jobQueue),
      inject: ['WebhookEndpointRepository', 'WebhookDeliveryRepository', 'JobQueuePort'],
    },
  ],
  exports: ['DeveloperEventsPort'],
})
export class DeveloperModule {}
