import { WebhookDeliveryRepository } from '../../../domain/repositories/webhook-delivery.repository.js';
import { WebhookDeliveryStatus } from '../../../domain/entities/webhook-delivery.entity.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, WebhookDeliveryNotFoundError } from '../../../domain/errors/domain-errors.js';
import { DEVELOPER_WEBHOOK_DELIVER_JOB } from './deliver-webhook.use-case.js';

/** Reintento manual desde la UI: resetea el contador y encola ya mismo. */
export class RetryWebhookDeliveryUseCase {
  constructor(
    private readonly deliveryRepo: WebhookDeliveryRepository,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(tenantId: string, deliveryId: string): Promise<Result<{ queued: true }, DomainError>> {
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery || delivery.tenantId !== tenantId) {
      return err(new WebhookDeliveryNotFoundError());
    }

    await this.deliveryRepo.update(deliveryId, {
      status: WebhookDeliveryStatus.PENDING,
      attempts: 0,
      nextRetryAt: null,
    });
    await this.jobQueue.enqueue(DEVELOPER_WEBHOOK_DELIVER_JOB, { deliveryId });

    return ok({ queued: true });
  }
}
