import { Notification } from '../../../domain/entities/notification.entity.js';
import { NotificationStatus } from '../../../domain/enums/notification-status.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { NotificationRepository } from '../../../domain/repositories/notification.repository.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { Result, err, ok } from '../../common/result.js';
import { serializeNotificationPayload } from './notification.util.js';

export interface CancelNotificationInput {
  tenantId: string;
  id: string;
}

/**
 * Cancela una notificación que todavía no salió. El `cancel` del repositorio
 * es atómico contra el estado `scheduled`: si el job ya la tomó, no hay vuelta
 * atrás y se responde NOTIFICATION_NOT_CANCELABLE.
 */
export class CancelNotificationUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly devEvents: DeveloperEventsPort,
  ) {}

  async execute(input: CancelNotificationInput): Promise<Result<Notification, DomainError>> {
    const notification = await this.notifications.findByTenantAndId(input.tenantId, input.id);
    if (!notification) {
      return err(new DomainError('NOTIFICATION_NOT_FOUND', 'Notification not found.'));
    }
    if (notification.status !== NotificationStatus.SCHEDULED) {
      return err(
        new DomainError(
          'NOTIFICATION_NOT_CANCELABLE',
          `The notification is already ${notification.status}; only scheduled notifications can be canceled.`,
        ),
      );
    }

    const canceled = await this.notifications.cancel(input.tenantId, input.id);
    if (!canceled) {
      return err(
        new DomainError(
          'NOTIFICATION_NOT_CANCELABLE',
          'The notification went out before it could be canceled.',
        ),
      );
    }

    this.devEvents.emit(
      canceled.tenantId,
      DeveloperEventType.NOTIFICATION_CANCELED,
      serializeNotificationPayload(canceled),
    );
    return ok(canceled);
  }
}
