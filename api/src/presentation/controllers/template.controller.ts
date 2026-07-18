import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject,
  NotFoundException, BadRequestException, ConflictException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CreateTemplateUseCase } from '../../application/use-cases/template/create-template.use-case.js';
import { UpdateTemplateUseCase } from '../../application/use-cases/template/update-template.use-case.js';
import { DeleteTemplateUseCase } from '../../application/use-cases/template/delete-template.use-case.js';
import { ListTemplatesUseCase } from '../../application/use-cases/template/list-templates.use-case.js';
import { GetTemplateUseCase } from '../../application/use-cases/template/get-template.use-case.js';
import { SyncTemplatesUseCase } from '../../application/use-cases/template/sync-templates.use-case.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
} from '../request-dtos/create-template-request.dto.js';
import type {
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
} from '../request-dtos/create-template-request.dto.js';
import { TemplateQueryParamsSchema } from '../request-dtos/template-query-params.dto.js';
import type { TemplateQueryParamsDto } from '../request-dtos/template-query-params.dto.js';
import type { MessageTemplateComponent } from '../../domain/entities/message-template.entity.js';
import type { DomainError } from '../../domain/errors/domain-errors.js';

@ApiTags('Templates')
@ApiBearerAuth('JWT')
@Controller('templates')
export class TemplateController {
  constructor(
    @Inject('CreateTemplateUseCase') private readonly createTemplate: CreateTemplateUseCase,
    @Inject('UpdateTemplateUseCase') private readonly updateTemplate: UpdateTemplateUseCase,
    @Inject('DeleteTemplateUseCase') private readonly deleteTemplate: DeleteTemplateUseCase,
    @Inject('ListTemplatesUseCase') private readonly listTemplates: ListTemplatesUseCase,
    @Inject('GetTemplateUseCase') private readonly getTemplate: GetTemplateUseCase,
    @Inject('SyncTemplatesUseCase') private readonly syncTemplates: SyncTemplatesUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List templates', description: 'List message templates for the tenant with optional filters' })
  @ApiQuery({ name: 'phoneNumberId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'pending', 'approved', 'rejected', 'paused', 'disabled'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by template name' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of templates' })
  async list(
    @Query(new ZodValidationPipe(TemplateQueryParamsSchema)) query: TemplateQueryParamsDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    return this.listTemplates.execute({ ...query, tenantId: agent.tenantId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template', description: 'Get a message template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template details' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async detail(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getTemplate.execute(agent.tenantId, id);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Post()
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({ summary: 'Create template', description: 'Create a message template and submit it to Meta for review (admin only)' })
  @ApiResponse({ status: 201, description: 'Template created and submitted for review' })
  @ApiResponse({ status: 400, description: 'Validation error or provider rejection' })
  async create(
    @Body(new ZodValidationPipe(CreateTemplateRequestSchema)) body: CreateTemplateRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createTemplate.execute({
      tenantId: agent.tenantId,
      phoneNumberId: body.phoneNumberId,
      name: body.name,
      language: body.language,
      category: body.category,
      components: body.components as MessageTemplateComponent[],
    });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Patch(':id')
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({ summary: 'Update template', description: 'Edit a template (goes back through Meta review, admin only)' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated and resubmitted for review' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTemplateRequestSchema)) body: UpdateTemplateRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateTemplate.execute({
      tenantId: agent.tenantId,
      templateId: id,
      category: body.category,
      components: body.components as MessageTemplateComponent[] | undefined,
    });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @DemoRestricted()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete template', description: 'Delete a template locally and on Meta (admin only)' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  async remove(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteTemplate.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
  }

  @Post('sync')
  @Roles('admin')
  @DemoRestricted()
  @HttpCode(200)
  @ApiOperation({ summary: 'Sync templates', description: 'Pull all templates from the WABA and upsert them locally (admin only)' })
  @ApiResponse({ status: 200, description: 'Sync result with count' })
  async sync(@Body() body: { phoneNumberId?: string }, @CurrentAgent() agent: RequestAgent) {
    if (!body?.phoneNumberId) throw new BadRequestException('phoneNumberId is required');
    const result = await this.syncTemplates.execute(agent.tenantId, body.phoneNumberId);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  private throwMapped(error: DomainError): never {
    switch (error.code) {
      case 'TEMPLATE_NOT_FOUND':
      case 'PHONE_NUMBER_NOT_FOUND':
        throw new NotFoundException(error.message);
      case 'TEMPLATE_ALREADY_EXISTS':
      case 'TEMPLATE_IN_USE':
        throw new ConflictException(error.message);
      default:
        throw new BadRequestException(error.message);
    }
  }
}
