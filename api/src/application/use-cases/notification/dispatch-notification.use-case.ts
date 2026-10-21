import { Notification } from '../../../domain/entities/notification.entity.js';
import { NotificationStatus } from '../../../domain/enums/notification-status.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { NotificationRepository } from '../../../domain/repositories/notification.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { SendApiMessageUseCase } from '../developer/send-api-message.use-case.js';
import { NOTIFICATION_SANDBOX_ADVANCE_JOB } from './notification.jobs.js';
import { serializeNotificationPayload } from './notification.util.js';

/** Cuánto tarda el sandbox en “entregar” y “leer”, para que el timeline se vea. */
const SANDBOX_DELIVERED_AFTER_MS = 1_500;
const SANDBOX_READ_AFTER_MS = 4_000;

/**
 * Hace el envío de una notificación ya creada.
 *
 * Corre en un job para que `POST /v1/notifications` responda 202 sin esperar a
 * Meta. Si el envío falla, la notificación queda `failed` con el código; no se
 * reintenta sola (un reintento automático de una plantilla rechazada solo
 * repite el error).
 */
export class DispatchNotificationUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly sendMessage: SendApiMessageUseCase,
    private readonly queue: JobQueuePort,
    private readonly devEvents: DeveloperEventsPort,
  ) {}

  async execute(notificationId: string): Promise<void> {
    let notification = await this.notifications.findById(notificationId);
    if (!notification) return;

    // Un job viejo de una notificación cancelada (o ya procesada) no hace nada.
    if (
      notification.status !== NotificationStatus.SCHEDULED &&
      notification.status !== NotificationStatus.QUEUED
    ) {
      return;
    }

    if (notification.status === NotificationStatus.SCHEDULED) {
      const queued = await this.notifications.updateStatus(notification.id, NotificationStatus.QUEUED, {
        queuedAt: new Date(),
      });
      if (!queued) return; // la cancelaron entre el schedule y el job
      notification = queued;
    }

    if (!notification.to || !notification.templateId) {
      await this.fail(
        notification,
        'INVALID_NOTIFICATION',
        'The notification has no destination or template.',
      );
      return;
    }

    let result: Awaited<ReturnType<SendApiMessageUseCase['execute']>>;
    try {
      result = await this.sendMessage.execute({
        tenantId: notification.tenantId,
        to: notification.to,
        templateId: notification.templateId,
        variables: notification.variables,
        phoneNumberId: notification.phoneNumberId ?? undefined,
        sandbox: notification.sandbox,
      });
    } catch (error) {
      await this.fail(
        notification,
        'SEND_FAILED',
        error instanceof Error ? error.message : 'The message could not be sent.',
      );
      return;
    }

    if (!result.ok) {
      await this.fail(notification, result.error.code, result.error.message);
      return;
    }

    const sent = await this.notifications.markSent(notification.id, {
      messageId: result.value.message.id,
      waMessageId: result.value.message.waMessageId,
      contactId: result.value.contactId,
      conversationId: result.value.conversationId,
      sentAt: new Date(),
    });
    if (!sent) return;

    this.emit(sent, DeveloperEventType.NOTIFICATION_SENT);

    if (sent.sandbox) {
      // En sandbox no hay webhooks de Meta: el timeline se completa solo.
      const now = Date.now();
      await this.queue.schedule(
        NOTIFICATION_SANDBOX_ADVANCE_JOB,
        { notificationId: sent.id, target: 'delivered' },
        new Date(now + SANDBOX_DELIVERED_AFTER_MS),
      );
      await this.queue.schedule(
        NOTIFICATION_SANDBOX_ADVANCE_JOB,
        { notificationId: sent.id, target: 'read' },
        new Date(now + SANDBOX_READ_AFTER_MS),
      );
    }
  }

  private async fail(notification: Notification, code: string, reason: string): Promise<void> {
    const failed = await this.notifications.updateStatus(notification.id, NotificationStatus.FAILED, {
      failedAt: new Date(),
      failureCode: code,
      failureReason: reason,
    });
    if (failed) this.emit(failed, DeveloperEventType.NOTIFICATION_FAILED);
  }

  private emit(notification: Notification, type: DeveloperEventType): void {
    this.devEvents.emit(
      notification.tenantId,
      type,
      serializeNotificationPayload(notification),
    );
  }
}
