import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { DeliverWebhookUseCase, DEVELOPER_WEBHOOK_DELIVER_JOB } from '../../application/use-cases/developer/deliver-webhook.use-case.js';

@Injectable()
export class DeveloperWebhookJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(DeveloperWebhookJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('DeliverWebhookUseCase') private readonly deliverWebhook: DeliverWebhookUseCase,
  ) {}

  onModuleInit(): void {
    // maxRetries=1: el use case gestiona sus propios reintentos con backoff
    // largo y log por intento; el retry de Agenda duplicaría entregas.
    this.queue.define(DEVELOPER_WEBHOOK_DELIVER_JOB, async (data) => {
      const { deliveryId } = data as { deliveryId: string };
      this.logger.debug(`Delivering developer webhook ${deliveryId}`);
      await this.deliverWebhook.execute(deliveryId);
    }, 10, 1);
  }
}
