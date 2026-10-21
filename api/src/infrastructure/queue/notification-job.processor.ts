import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { DispatchNotificationUseCase } from '../../application/use-cases/notification/dispatch-notification.use-case.js';
import { AdvanceSandboxNotificationUseCase } from '../../application/use-cases/notification/advance-sandbox-notification.use-case.js';
import type { SandboxTarget } from '../../application/use-cases/notification/advance-sandbox-notification.use-case.js';
import {
  NOTIFICATION_SANDBOX_ADVANCE_JOB,
  NOTIFICATION_SEND_JOB,
} from '../../application/use-cases/notification/notification.jobs.js';

/**
 * Jobs del ciclo de vida de una notificación.
 *
 * `maxRetries=1`: el envío no se reintenta solo. Si Meta rechaza una plantilla,
 * reintentar tres veces repite el mismo error y confunde el estado; el fallo se
 * guarda y el desarrollador decide. (El reintento manual queda para más
 * adelante.)
 */
@Injectable()
export class NotificationJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(NotificationJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('DispatchNotificationUseCase')
    private readonly dispatch: DispatchNotificationUseCase,
    @Inject('AdvanceSandboxNotificationUseCase')
    private readonly advanceSandbox: AdvanceSandboxNotificationUseCase,
  ) {}

  onModuleInit(): void {
    this.queue.define(
      NOTIFICATION_SEND_JOB,
      async (data) => {
        const { notificationId } = data as { notificationId: string };
        this.logger.debug(`Dispatching notification ${notificationId}`);
        await this.dispatch.execute(notificationId);
      },
      10,
      1,
    );

    this.queue.define(
      NOTIFICATION_SANDBOX_ADVANCE_JOB,
      async (data) => {
        const { notificationId, target } = data as {
          notificationId: string;
          target: SandboxTarget;
        };
        this.logger.debug(`Advancing sandbox notification ${notificationId} to ${target}`);
        await this.advanceSandbox.execute(notificationId, target);
      },
      10,
      1,
    );
  }
}
