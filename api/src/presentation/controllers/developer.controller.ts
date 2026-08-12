import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Inject, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateApiKeyRequestSchema, CreateWebhookRequestSchema, UpdateWebhookRequestSchema,
} from '../request-dtos/developer-requests.dto.js';
import type {
  CreateApiKeyRequestDto, CreateWebhookRequestDto, UpdateWebhookRequestDto,
} from '../request-dtos/developer-requests.dto.js';
import { GetDeveloperOverviewUseCase } from '../../application/use-cases/developer/get-developer-overview.use-case.js';
import { CreateApiKeyUseCase } from '../../application/use-cases/developer/create-api-key.use-case.js';
import { ListApiKeysUseCase } from '../../application/use-cases/developer/list-api-keys.use-case.js';
import { RevokeApiKeyUseCase } from '../../application/use-cases/developer/revoke-api-key.use-case.js';
import { CreateWebhookEndpointUseCase } from '../../application/use-cases/developer/create-webhook-endpoint.use-case.js';
import { UpdateWebhookEndpointUseCase } from '../../application/use-cases/developer/update-webhook-endpoint.use-case.js';
import { DeleteWebhookEndpointUseCase } from '../../application/use-cases/developer/delete-webhook-endpoint.use-case.js';
import { ListWebhookEndpointsUseCase } from '../../application/use-cases/developer/list-webhook-endpoints.use-case.js';
import { RotateWebhookSecretUseCase } from '../../application/use-cases/developer/rotate-webhook-secret.use-case.js';
import { ListWebhookDeliveriesUseCase } from '../../application/use-cases/developer/list-webhook-deliveries.use-case.js';
import { RetryWebhookDeliveryUseCase } from '../../application/use-cases/developer/retry-webhook-delivery.use-case.js';
import { SendTestWebhookUseCase } from '../../application/use-cases/developer/send-test-webhook.use-case.js';
import { DomainError } from '../../domain/errors/domain-errors.js';
import { SUBSCRIBABLE_DEVELOPER_EVENTS } from '../../domain/enums/developer-event-type.enum.js';

/** Gestión de la plataforma de desarrolladores desde la app (solo admins). */
@ApiTags('Developer Platform')
@ApiBearerAuth('JWT')
@Roles('admin')
@Controller('developer')
export class DeveloperController {
  constructor(
    @Inject('GetDeveloperOverviewUseCase') private readonly getOverview: GetDeveloperOverviewUseCase,
    @Inject('CreateApiKeyUseCase') private readonly createApiKey: CreateApiKeyUseCase,
    @Inject('ListApiKeysUseCase') private readonly listApiKeys: ListApiKeysUseCase,
    @Inject('RevokeApiKeyUseCase') private readonly revokeApiKey: RevokeApiKeyUseCase,
    @Inject('CreateWebhookEndpointUseCase') private readonly createWebhook: CreateWebhookEndpointUseCase,
    @Inject('UpdateWebhookEndpointUseCase') private readonly updateWebhook: UpdateWebhookEndpointUseCase,
    @Inject('DeleteWebhookEndpointUseCase') private readonly deleteWebhook: DeleteWebhookEndpointUseCase,
    @Inject('ListWebhookEndpointsUseCase') private readonly listWebhooks: ListWebhookEndpointsUseCase,
    @Inject('RotateWebhookSecretUseCase') private readonly rotateSecret: RotateWebhookSecretUseCase,
    @Inject('ListWebhookDeliveriesUseCase') private readonly listDeliveries: ListWebhookDeliveriesUseCase,
    @Inject('RetryWebhookDeliveryUseCase') private readonly retryDelivery: RetryWebhookDeliveryUseCase,
    @Inject('SendTestWebhookUseCase') private readonly sendTest: SendTestWebhookUseCase,
  ) {}

  private fail(error: DomainError): never {
    if (error.code.endsWith('_NOT_FOUND')) throw new NotFoundException(error.message);
    if (error.code === 'FEATURE_NOT_IN_PLAN') throw new ForbiddenException({ message: error.message, code: error.code });
    throw new BadRequestException({ message: error.message, code: error.code });
  }

  @Get('overview')
  @ApiOperation({ summary: 'Developer platform status', description: 'Plan features and current usage for gating the UI.' })
  overview(@CurrentAgent() agent: RequestAgent) {
    return this.getOverview.execute(agent.tenantId);
  }

  @Get('events')
  @ApiOperation({ summary: 'Subscribable webhook events' })
  events() {
    return { data: SUBSCRIBABLE_DEVELOPER_EVENTS };
  }

  // ── API keys ──────────────────────────────────────────────────────────

  @Get('api-keys')
  @ApiOperation({ summary: 'List API keys' })
  apiKeys(@CurrentAgent() agent: RequestAgent) {
    return this.listApiKeys.execute(agent.tenantId);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Create API key', description: 'The full key is returned once and cannot be recovered.' })
  async createKey(
    @Body(new ZodValidationPipe(CreateApiKeyRequestSchema)) body: CreateApiKeyRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createApiKey.execute({
      tenantId: agent.tenantId,
      name: body.name,
      scopes: body.scopes,
      createdBy: agent._id,
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiParam({ name: 'id' })
  async revokeKey(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.revokeApiKey.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  // ── Webhook endpoints ─────────────────────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'List webhook endpoints' })
  webhooks(@CurrentAgent() agent: RequestAgent) {
    return this.listWebhooks.execute(agent.tenantId);
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Create webhook endpoint' })
  async createWebhookEndpoint(
    @Body(new ZodValidationPipe(CreateWebhookRequestSchema)) body: CreateWebhookRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createWebhook.execute({
      tenantId: agent.tenantId,
      url: body.url,
      description: body.description ?? null,
      events: body.events,
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Patch('webhooks/:id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  @ApiParam({ name: 'id' })
  async updateWebhookEndpoint(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWebhookRequestSchema)) body: UpdateWebhookRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateWebhook.execute({
      tenantId: agent.tenantId,
      endpointId: id,
      url: body.url,
      description: body.description,
      events: body.events,
      active: body.active,
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  @ApiParam({ name: 'id' })
  async deleteWebhookEndpoint(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteWebhook.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Post('webhooks/:id/rotate-secret')
  @ApiOperation({ summary: 'Rotate signing secret' })
  @ApiParam({ name: 'id' })
  async rotateWebhookSecret(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.rotateSecret.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Post('webhooks/:id/test')
  @ApiOperation({ summary: 'Send test ping', description: 'Queues a `ping` event to the endpoint, regardless of its subscriptions.' })
  @ApiParam({ name: 'id' })
  async testWebhook(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.sendTest.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Get('webhooks/:id/deliveries')
  @ApiOperation({ summary: 'Delivery log of an endpoint' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async deliveries(
    @Param('id') id: string,
    @CurrentAgent() agent: RequestAgent,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.listDeliveries.execute({
      tenantId: agent.tenantId,
      endpointId: id,
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Post('deliveries/:id/retry')
  @ApiOperation({ summary: 'Retry a delivery now' })
  @ApiParam({ name: 'id' })
  async retry(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.retryDelivery.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }
}
