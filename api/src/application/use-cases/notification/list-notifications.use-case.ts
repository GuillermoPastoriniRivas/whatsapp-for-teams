import { Notification } from '../../../domain/entities/notification.entity.js';
import { NotificationStatus } from '../../../domain/enums/notification-status.enum.js';
import { NotificationRepository } from '../../../domain/repositories/notification.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';

export interface ListNotificationsInput {
  tenantId: string;
  status?: NotificationStatus;
  templateId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

/** Historial de notificaciones de la cuenta, de la más nueva a la más vieja. */
export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(input: ListNotificationsInput): Promise<PaginatedResult<Notification>> {
    return this.notifications.findByFilters(input);
  }
}
