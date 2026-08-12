import { Controller, Get, Query, Param, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import {
  GetTemplateAnalyticsUseCase,
  GetWhatsAppAnalyticsUseCase,
} from '../../application/use-cases/analytics/get-whatsapp-analytics.use-case.js';
import type { DomainError } from '../../domain/errors/domain-errors.js';
import type { GetMessageUsageUseCase } from '../../application/use-cases/billing/get-message-usage.use-case.js';
import type { ReconcileMetaUsageUseCase } from '../../application/use-cases/billing/reconcile-meta-usage.use-case.js';
import type { GetAdPerformanceUseCase } from '../../application/use-cases/analytics/get-ad-performance.use-case.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

/**
 * Las dimensiones que Meta no puede darnos porque no las sabe: quién mandó el
 * mensaje, de qué campaña salió, con qué plantilla.
 */
const MESSAGE_USAGE_GROUPS = [
  'category',
  'senderKind',
  'campaign',
  'template',
  'phoneNumber',
  'country',
  'day',
  'ad',
] as const;

@ApiTags('Analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject('GetWhatsAppAnalyticsUseCase') private readonly getAnalytics: GetWhatsAppAnalyticsUseCase,
    @Inject('GetTemplateAnalyticsUseCase') private readonly getTemplateAnalytics: GetTemplateAnalyticsUseCase,
    @Inject('GetMessageUsageUseCase') private readonly messageUsage_: GetMessageUsageUseCase,
    @Inject('ReconcileMetaUsageUseCase') private readonly reconcile: ReconcileMetaUsageUseCase,
    @Inject('GetAdPerformanceUseCase') private readonly adPerformance: GetAdPerformanceUseCase,
  ) {}

  @Get('phone-numbers/:id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Messaging and conversation analytics',
    description:
      'Volume and billable cost for a number, straight from Meta. We count messages; Meta bills conversations — ' +
      'the cost always comes from Meta, never from our own counters.',
  })
  @ApiParam({ name: 'id', description: 'Phone number ID' })
  @ApiQuery({ name: 'start', required: false, description: 'ISO date. Defaults to 30 days ago.' })
  @ApiQuery({ name: 'end', required: false, description: 'ISO date. Defaults to now.' })
  @ApiQuery({ name: 'granularity', required: false, enum: ['DAY', 'MONTH'] })
  @ApiResponse({ status: 200, description: 'Analytics' })
  async phoneAnalytics(
    @Param('id') id: string,
    @CurrentAgent() agent: RequestAgent,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('granularity') granularity?: string,
  ) {
    const range = this.parseRange(start, end);
    const result = await this.getAnalytics.execute({
      tenantId: agent.tenantId,
      phoneId: id,
      ...range,
      granularity: granularity === 'MONTH' ? 'MONTH' : 'DAY',
    });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Get('phone-numbers/:id/templates')
  @Roles('admin')
  @ApiOperation({
    summary: 'Template analytics',
    description: 'Sent, delivered, read and per-button clicks. Meta accepts up to 10 templates per query.',
  })
  @ApiParam({ name: 'id', description: 'Phone number ID' })
  @ApiQuery({ name: 'templateIds', required: false, description: 'Comma-separated template IDs' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiResponse({ status: 200, description: 'Template analytics' })
  async templateAnalytics(
    @Param('id') id: string,
    @CurrentAgent() agent: RequestAgent,
    @Query('templateIds') templateIds?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const result = await this.getTemplateAnalytics.execute({
      tenantId: agent.tenantId,
      phoneId: id,
      ...this.parseRange(start, end),
      templateIds: templateIds ? templateIds.split(',').filter(Boolean) : undefined,
    });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Get('messages')
  @Roles('admin')
  @ApiOperation({
    summary: 'Message volume and cost, from our own ledger',
    description:
      'Delivered messages and their cost for a period, broken down by dimensions Meta cannot know — who sent ' +
      'the message, which campaign, which template. These messages are billed by Meta directly to the ' +
      "customer: asis applies no markup and does not charge for them. Meta's invoice is the source of truth.",
  })
  @ApiQuery({ name: 'start', required: false, description: 'ISO date. Defaults to 30 days ago.' })
  @ApiQuery({ name: 'end', required: false, description: 'ISO date. Defaults to now.' })
  @ApiQuery({ name: 'phoneNumberId', required: false })
  @ApiQuery({ name: 'groupBy', required: false, enum: MESSAGE_USAGE_GROUPS })
  @ApiResponse({ status: 200, description: 'Message usage and cost' })
  async messageUsage(
    @CurrentAgent() agent: RequestAgent,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('phoneNumberId') phoneNumberId?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const range = this.parseRange(start, end);
    return this.messageUsage_.execute({
      tenantId: agent.tenantId,
      from: range.start,
      to: range.end,
      phoneNumberId,
      groupBy: MESSAGE_USAGE_GROUPS.includes(groupBy as never) ? (groupBy as never) : undefined,
    });
  }

  @Get('ads')
  @Roles('admin')
  @ApiOperation({
    summary: 'Performance por anuncio Click-to-WhatsApp',
    description:
      'Conversaciones, contactos y costo de mensajería agrupados por el anuncio o posteo que trajo el lead. ' +
      'La atribución sale del objeto `referral` que Meta manda en el primer mensaje después del click.',
  })
  @ApiQuery({ name: 'start', required: false, description: 'ISO date. Defaults to 30 days ago.' })
  @ApiQuery({ name: 'end', required: false, description: 'ISO date. Defaults to now.' })
  @ApiQuery({ name: 'phoneNumberId', required: false })
  @ApiResponse({ status: 200, description: 'Ad performance' })
  async ads(
    @CurrentAgent() agent: RequestAgent,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('phoneNumberId') phoneNumberId?: string,
  ) {
    const range = this.parseRange(start, end);
    return this.adPerformance.execute({
      tenantId: agent.tenantId,
      from: range.start,
      to: range.end,
      phoneNumberId,
    });
  }

  @Get('messages/reconciliation')
  @Roles('admin')
  @ApiOperation({
    summary: 'Reconcile our ledger against Meta',
    description:
      'Compares our delivered-message ledger against what Meta reports for the same WABA and period. ' +
      'A non-zero delta means a webhook was lost or a send went unrecorded.',
  })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  async reconciliation(
    @CurrentAgent() agent: RequestAgent,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const range = this.parseRange(start, end);
    return this.reconcile.execute(agent.tenantId, range.start, range.end);
  }

  private parseRange(start?: string, end?: string): { start: Date; end: Date } {
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(endDate.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Las fechas tienen que ser ISO válidas.');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('La fecha de inicio tiene que ser anterior a la de fin.');
    }

    return { start: startDate, end: endDate };
  }

  private throwMapped(error: DomainError): never {
    switch (error.code) {
      case 'PHONE_NUMBER_NOT_FOUND':
      case 'CROSS_TENANT_ACCESS':
        throw new NotFoundException(error.message);
      default:
        throw new BadRequestException(error.message);
    }
  }
}
