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

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

@ApiTags('Analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject('GetWhatsAppAnalyticsUseCase') private readonly getAnalytics: GetWhatsAppAnalyticsUseCase,
    @Inject('GetTemplateAnalyticsUseCase') private readonly getTemplateAnalytics: GetTemplateAnalyticsUseCase,
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
