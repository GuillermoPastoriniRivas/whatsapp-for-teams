import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject,
  NotFoundException, BadRequestException, ConflictException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CreateCampaignUseCase } from '../../application/use-cases/campaign/create-campaign.use-case.js';
import { UpdateCampaignUseCase } from '../../application/use-cases/campaign/update-campaign.use-case.js';
import { StartCampaignUseCase } from '../../application/use-cases/campaign/start-campaign.use-case.js';
import { PauseCampaignUseCase } from '../../application/use-cases/campaign/pause-campaign.use-case.js';
import { ResumeCampaignUseCase } from '../../application/use-cases/campaign/resume-campaign.use-case.js';
import { CancelCampaignUseCase } from '../../application/use-cases/campaign/cancel-campaign.use-case.js';
import { DeleteCampaignUseCase } from '../../application/use-cases/campaign/delete-campaign.use-case.js';
import { ListCampaignsUseCase } from '../../application/use-cases/campaign/list-campaigns.use-case.js';
import { GetCampaignUseCase } from '../../application/use-cases/campaign/get-campaign.use-case.js';
import { ListCampaignRecipientsUseCase } from '../../application/use-cases/campaign/list-campaign-recipients.use-case.js';
import { GetCampaignStatsUseCase } from '../../application/use-cases/campaign/get-campaign-stats.use-case.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
} from '../request-dtos/create-campaign-request.dto.js';
import type {
  CreateCampaignRequestDto,
  UpdateCampaignRequestDto,
} from '../request-dtos/create-campaign-request.dto.js';
import {
  CampaignQueryParamsSchema,
  CampaignRecipientQueryParamsSchema,
} from '../request-dtos/campaign-query-params.dto.js';
import type {
  CampaignQueryParamsDto,
  CampaignRecipientQueryParamsDto,
} from '../request-dtos/campaign-query-params.dto.js';
import type { DomainError } from '../../domain/errors/domain-errors.js';

@ApiTags('Campaigns')
@ApiBearerAuth('JWT')
@Controller('campaigns')
export class CampaignController {
  constructor(
    @Inject('CreateCampaignUseCase') private readonly createCampaign: CreateCampaignUseCase,
    @Inject('UpdateCampaignUseCase') private readonly updateCampaign: UpdateCampaignUseCase,
    @Inject('StartCampaignUseCase') private readonly startCampaign: StartCampaignUseCase,
    @Inject('PauseCampaignUseCase') private readonly pauseCampaign: PauseCampaignUseCase,
    @Inject('ResumeCampaignUseCase') private readonly resumeCampaign: ResumeCampaignUseCase,
    @Inject('CancelCampaignUseCase') private readonly cancelCampaign: CancelCampaignUseCase,
    @Inject('DeleteCampaignUseCase') private readonly deleteCampaign: DeleteCampaignUseCase,
    @Inject('ListCampaignsUseCase') private readonly listCampaigns: ListCampaignsUseCase,
    @Inject('GetCampaignUseCase') private readonly getCampaign: GetCampaignUseCase,
    @Inject('ListCampaignRecipientsUseCase') private readonly listRecipients: ListCampaignRecipientsUseCase,
    @Inject('GetCampaignStatsUseCase') private readonly getStats: GetCampaignStatsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns', description: 'List campaigns for the tenant with optional filters' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'] })
  @ApiQuery({ name: 'phoneNumberId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of campaigns' })
  async list(
    @Query(new ZodValidationPipe(CampaignQueryParamsSchema)) query: CampaignQueryParamsDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    return this.listCampaigns.execute({ ...query, tenantId: agent.tenantId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign', description: 'Get a campaign by ID' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign details' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async detail(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getCampaign.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Get(':id/recipients')
  @ApiOperation({ summary: 'List campaign recipients', description: 'Per-recipient delivery status for a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of recipients' })
  async recipients(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(CampaignRecipientQueryParamsSchema)) query: CampaignRecipientQueryParamsDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.listRecipients.execute(agent.tenantId, id, query);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get campaign stats', description: 'Aggregated delivery and response metrics for a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Counts, deliveredRate, readRate, responseRate and failure breakdown' })
  async stats(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getStats.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create campaign', description: 'Create a draft campaign for an approved template (admin only)' })
  @ApiResponse({ status: 201, description: 'Campaign created as draft' })
  async create(
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema)) body: CreateCampaignRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createCampaign.execute({
      tenantId: agent.tenantId,
      createdByAgentId: agent._id,
      name: body.name,
      phoneNumberId: body.phoneNumberId,
      templateId: body.templateId,
      variableMappings: body.variableMappings,
      audience: body.audience,
      scheduledAt: body.scheduledAt ?? null,
      throttle: body.throttle,
      replyWindowHours: body.replyWindowHours,
    });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update campaign', description: 'Edit a draft campaign (admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign updated' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCampaignRequestSchema)) body: UpdateCampaignRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateCampaign.execute({ tenantId: agent.tenantId, campaignId: id, ...body });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Post(':id/start')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start campaign', description: 'Materialize the audience and start (or schedule) sending (admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign started or scheduled' })
  async start(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.startCampaign.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Post(':id/pause')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pause campaign', description: 'Pause a running or scheduled campaign (admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign paused' })
  async pause(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.pauseCampaign.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Post(':id/resume')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resume campaign', description: 'Resume a paused campaign (admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign resumed' })
  async resume(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.resumeCampaign.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Post(':id/cancel')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel campaign', description: 'Cancel a campaign; unsent recipients are skipped (admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 200, description: 'Campaign cancelled' })
  async cancel(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.cancelCampaign.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @DemoRestricted()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete campaign', description: 'Delete a draft or cancelled campaign and its recipients (admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({ status: 204, description: 'Campaign deleted' })
  async remove(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteCampaign.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
  }

  private throwMapped(error: DomainError): never {
    switch (error.code) {
      case 'CAMPAIGN_NOT_FOUND':
      case 'TEMPLATE_NOT_FOUND':
      case 'PHONE_NUMBER_NOT_FOUND':
        throw new NotFoundException(error.message);
      case 'INVALID_CAMPAIGN_STATE':
      case 'CAMPAIGN_ALREADY_ACTIVE_ON_PHONE':
        throw new ConflictException(error.message);
      default:
        throw new BadRequestException(error.message);
    }
  }
}
