import { Notification } from '../../../domain/entities/notification.entity.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { NotificationRepository } from '../../../domain/repositories/notification.repository.js';
import { Result, err, ok } from '../../common/result.js';

export interface GetNotificationInput {
  tenantId: string;
  id: string;
}

/** Detalle de una notificación, siempre acotado al tenant que la pide. */
export class GetNotificationUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: GetNotificationInput): Promise<Result<Notification, DomainError>> {
    const notification = await this.notifications.findByTenantAndId(input.tenantId, input.id);
    if (!notification) {
      return err(new DomainError('NOTIFICATION_NOT_FOUND', 'Notification not found.'));
    }
    return ok(notification);
  }
}
