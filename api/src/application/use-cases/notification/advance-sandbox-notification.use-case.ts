import { NotificationStatus } from '../../../domain/enums/notification-status.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { NotificationRepository } from '../../../domain/repositories/notification.repository.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { serializeNotificationPayload } from './notification.util.js';

export type SandboxTarget = 'delivered' | 'read';

/**
 * Completa el recorrido de una notificación de sandbox. No toca mensajes,
 * contabilidad ni Meta: sólo avanza el estado y emite el webhook que el
 * desarrollador habría recibido de verdad.
 */
export class AdvanceSandboxNotificationUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly devEvents: DeveloperEventsPort,
  ) {}

  async execute(notificationId: string, target: SandboxTarget): Promise<void> {
    const notification = await this.notifications.findById(notificationId);
    if (!notification || !notification.sandbox) return;

    const now = new Date();
    const updated =
      target === 'delivered'
        ? await this.notifications.updateStatus(notification.id, NotificationStatus.DELIVERED, {
            deliveredAt: now,
          })
        : await this.notifications.updateStatus(notification.id, NotificationStatus.READ, {
            readAt: now,
            deliveredAt: notification.deliveredAt ?? now,
          });

    if (!updated) return;

    this.devEvents.emit(
      updated.tenantId,
      target === 'delivered'
        ? DeveloperEventType.NOTIFICATION_DELIVERED
        : DeveloperEventType.NOTIFICATION_READ,
      serializeNotificationPayload(updated),
    );
  }
}
