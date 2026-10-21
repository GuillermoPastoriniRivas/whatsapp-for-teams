import {
  Controller, Get, Post, Body, Param, Query, Headers, Inject, UseGuards,
  HttpException, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiSecurity, ApiQuery, ApiParam, ApiHeader, ApiResponse,
} from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator.js';
import { ApiKeyGuard } from '../guards/api-key.guard.js';
import { ApiPrincipal } from '../decorators/api-principal.decorator.js';
import type { ApiKeyPrincipal } from '../decorators/api-principal.decorator.js';
import { RequireScopes } from '../decorators/require-scopes.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateNotificationRequestSchema,
  NotificationQuerySchema,
  NOTIFICATION_STATUSES,
  buildNotificationList,
  executeById,
  executeList,
  serializeNotification,
  settle,
  unwrapNotification,
} from '../request-dtos/notification-request.dto.js';
import type {
  CreateNotificationRequestDto,
  NotificationQueryDto,
  CancelNotificationUseCaseContract,
  GetNotificationUseCaseContract,
  ListNotificationsUseCaseContract,
  SendNotificationUseCaseContract,
} from '../request-dtos/notification-request.dto.js';

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

/** Una clave `ak_test_` es sandbox: nunca llega a Meta. */
function isSandboxKey(principal: ApiKeyPrincipal): boolean {
  return principal.apiKeyMode === 'test';
}

/**
 * La clave de idempotencia es obligatoria: sin ella el mismo pedido puede
 * generar dos notificaciones.
 */
function readIdempotencyKey(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.trim()) {
    throw new HttpException(
      {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Send the `Idempotency-Key` header with a unique value for every notification.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  const key = value.trim();
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new HttpException(
      {
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: `\`Idempotency-Key\` is too long (max ${MAX_IDEMPOTENCY_KEY_LENGTH} characters).`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  return key;
}

function notificationNotFound(): never {
  throw new HttpException(
    { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * API pública de notificaciones (autenticación por API key).
 * Prefijo global 'api' ⇒ rutas /api/v1/notifications.
 */
@ApiTags('Public API (v1)')
@ApiSecurity('ApiKey')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class PublicNotificationsController {
  constructor(
    @Inject('SendNotificationUseCase') private readonly sendNotification: SendNotificationUseCaseContract,
    @Inject('GetNotificationUseCase') private readonly getNotification: GetNotificationUseCaseContract,
    @Inject('ListNotificationsUseCase') private readonly listNotifications: ListNotificationsUseCaseContract,
    @Inject('CancelNotificationUseCase') private readonly cancelNotification: CancelNotificationUseCaseContract,
  ) {}

  @Post('notifications')
  @RequireScopes('notifications:write')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a notification',
    description:
      'Schedules a WhatsApp template message and answers right away with 202; the delivery ' +
      'status is tracked in the notification (GET /v1/notifications/{id}). ' +
      'Use `sendAt` to schedule it for later. The same `Idempotency-Key` always returns the ' +
      'same notification.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key per notification. Reusing it with another body answers 409.',
  })
  @ApiResponse({ status: 202, description: 'Notification accepted' })
  @ApiResponse({ status: 400, description: 'Missing or invalid `Idempotency-Key` (MISSING_IDEMPOTENCY_KEY)' })
  @ApiResponse({ status: 403, description: 'The API key does not have `notifications:write` (MISSING_SCOPE)' })
  @ApiResponse({ status: 409, description: 'The key was used with a different body (IDEMPOTENCY_KEY_REUSED)' })
  @ApiResponse({ status: 422, description: 'The template or the destination cannot be used' })
  async create(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Body(new ZodValidationPipe(CreateNotificationRequestSchema)) body: CreateNotificationRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = readIdempotencyKey(idempotencyKey);
    const sandbox = isSandboxKey(principal);

    const outcome = await settle<unknown>(
      this.sendNotification.execute({
        tenantId: principal.tenantId,
        to: body.to,
        templateId: body.templateId,
        template: body.template,
        variables: body.variables,
        sendAt: body.sendAt,
        metadata: body.metadata,
        phoneNumberId: body.phoneNumberId,
        idempotencyKey: key,
        sandbox,
        createdByAgentId: principal.createdByAgentId ?? null,
      }),
    );

    const notification = unwrapNotification(outcome);
    if (!notification?.id) {
      throw new HttpException(
        { code: 'NOTIFICATION_NOT_CREATED', message: 'The notification could not be created.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      id: notification.id,
      status: notification.status,
      sendAt: notification.sendAt ?? null,
      sandbox: notification.sandbox ?? sandbox,
    };
  }

  @Get('notifications')
  @RequireScopes('notifications:read')
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
  @ApiResponse({ status: 403, description: 'The API key does not have `notifications:read` (MISSING_SCOPE)' })
  async list(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Query(new ZodValidationPipe(NotificationQuerySchema)) query: NotificationQueryDto,
  ) {
    const outcome = await executeList(this.listNotifications, principal.tenantId, {
      tenantId: principal.tenantId,
      status: query.status,
      templateId: query.templateId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });
    return buildNotificationList(outcome, query.page, query.limit);
  }

  @Get('notifications/:id')
  @RequireScopes('notifications:read')
  @ApiOperation({
    summary: 'Get a notification',
    description: 'State of a notification and the timeline of what happened with it.',
  })
  @ApiParam({ name: 'id', description: 'Notification id (ntf_...)' })
  @ApiResponse({ status: 200, description: 'Notification detail' })
  @ApiResponse({ status: 404, description: 'Notification not found (NOTIFICATION_NOT_FOUND)' })
  async detail(
    @Param('id') id: string,
    @ApiPrincipal() principal: ApiKeyPrincipal,
  ) {
    const outcome = await executeById<unknown>(this.getNotification, principal.tenantId, id);
    const notification = unwrapNotification(outcome);
    if (!notification?.id) notificationNotFound();
    return serializeNotification(notification);
  }

  @Post('notifications/:id/cancel')
  @RequireScopes('notifications:write')
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
    @ApiPrincipal() principal: ApiKeyPrincipal,
  ) {
    const outcome = await executeById<unknown>(this.cancelNotification, principal.tenantId, id);
    const notification = unwrapNotification(outcome);
    if (!notification?.id) notificationNotFound();
    return { id: notification.id, status: notification.status };
  }
}
