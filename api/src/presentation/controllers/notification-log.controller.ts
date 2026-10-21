import {
  Controller, Get, Post, Param, Query, Inject, HttpException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  NotificationQuerySchema,
  NOTIFICATION_STATUSES,
  buildNotificationList,
  executeById,
  executeList,
  serializeNotification,
  unwrapNotification,
} from '../request-dtos/notification-request.dto.js';
import type {
  NotificationQueryDto,
  CancelNotificationUseCaseContract,
  GetNotificationUseCaseContract,
  ListNotificationsUseCaseContract,
} from '../request-dtos/notification-request.dto.js';

function notificationNotFound(): never {
  throw new HttpException(
    { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * Panel del equipo: el historial de notificaciones de la cuenta (las que se
 * mandaron por la API pública). Va con sesión JWT y siempre acotado al tenant
 * del agente. Convive con el controller de web-push, que usa `push/*`.
 */
@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationLogController {
  constructor(
    @Inject('GetNotificationUseCase') private readonly getNotification: GetNotificationUseCaseContract,
    @Inject('ListNotificationsUseCase') private readonly listNotifications: ListNotificationsUseCaseContract,
    @Inject('CancelNotificationUseCase') private readonly cancelNotification: CancelNotificationUseCaseContract,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: 'Notifications of the account, newest first. Filter by status, template or date range.',
  })
  @ApiQuery({ name: 'status', required: false, enum: NOTIFICATION_STATUSES })
  @ApiQuery({ name: 'templateId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 date (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 date (inclusive)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications' })
  async list(
    @Query(new ZodValidationPipe(NotificationQuerySchema)) query: NotificationQueryDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const outcome = await executeList(this.listNotifications, agent.tenantId, {
      tenantId: agent.tenantId,
      status: query.status,
      templateId: query.templateId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });
    return buildNotificationList(outcome, query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a notification',
    description: 'State of a notification and the timeline of what happened with it.',
  })
  @ApiParam({ name: 'id', description: 'Notification id (ntf_...)' })
  @ApiResponse({ status: 200, description: 'Notification detail' })
  @ApiResponse({ status: 404, description: 'Notification not found (NOTIFICATION_NOT_FOUND)' })
  async detail(
    @Param('id') id: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const outcome = await executeById<unknown>(this.getNotification, agent.tenantId, id);
    const notification = unwrapNotification(outcome);
    if (!notification?.id) notificationNotFound();
    return serializeNotification(notification);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a notification',
    description: 'Cancels a notification that did not go out yet. It fails with 409 if it already did.',
  })
  @ApiParam({ name: 'id', description: 'Notification id (ntf_...)' })
  @ApiResponse({ status: 200, description: 'Notification canceled' })
  @ApiResponse({ status: 404, description: 'Notification not found (NOTIFICATION_NOT_FOUND)' })
  @ApiResponse({ status: 409, description: 'The notification already went out (NOTIFICATION_NOT_CANCELABLE)' })
  async cancel(
    @Param('id') id: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const outcome = await executeById<unknown>(this.cancelNotification, agent.tenantId, id);
    const notification = unwrapNotification(outcome);
    if (!notification?.id) notificationNotFound();
    return { id: notification.id, status: notification.status };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.NOT_FOUND)
  @ApiOperation({
    summary: 'Retry a failed notification',
    description:
      'Not available yet: the notifications core does not expose a retry. It answers 404 with ' +
      'the code NOTIFICATION_RETRY_NOT_SUPPORTED.',
  })
  @ApiParam({ name: 'id', description: 'Notification id (ntf_...)' })
  @ApiResponse({ status: 404, description: 'Retries are not supported yet (NOTIFICATION_RETRY_NOT_SUPPORTED)' })
  async retry() {
    throw new HttpException(
      {
        code: 'NOTIFICATION_RETRY_NOT_SUPPORTED',
        message: 'Retrying a notification is not available yet.',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
