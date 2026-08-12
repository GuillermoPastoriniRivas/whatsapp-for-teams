import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Inject, NotFoundException, ConflictException, ForbiddenException,
  UnprocessableEntityException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateFlowRequestSchema,
  UpdateFlowRequestSchema,
  FlowExecutionsQuerySchema,
  FlowStatsQuerySchema,
  CreateFlowConnectionRequestSchema,
  SimulateFlowRequestSchema,
  SetupAssistantRequestSchema,
} from '../request-dtos/flow-request.dto.js';
import type {
  CreateFlowRequestDto,
  UpdateFlowRequestDto,
  FlowExecutionsQueryDto,
  FlowStatsQueryDto,
  CreateFlowConnectionRequestDto,
  SimulateFlowRequestDto,
  SetupAssistantRequestDto,
} from '../request-dtos/flow-request.dto.js';
import { CreateFlowUseCase } from '../../application/use-cases/flow/create-flow.use-case.js';
import { ListFlowsUseCase } from '../../application/use-cases/flow/list-flows.use-case.js';
import { GetFlowUseCase } from '../../application/use-cases/flow/get-flow.use-case.js';
import { UpdateFlowUseCase } from '../../application/use-cases/flow/update-flow.use-case.js';
import { PublishFlowUseCase } from '../../application/use-cases/flow/publish-flow.use-case.js';
import {
  PauseFlowUseCase, ActivateFlowUseCase, ArchiveFlowUseCase, RegenerateWebhookTokenUseCase,
} from '../../application/use-cases/flow/flow-lifecycle.use-cases.js';
import {
  ListFlowExecutionsUseCase, GetFlowExecutionUseCase, CancelFlowExecutionUseCase,
  GetFlowStatsUseCase, GetFlowVersionsUseCase, GetFlowVersionUseCase,
} from '../../application/use-cases/flow/flow-executions.use-cases.js';
import {
  CreateFlowConnectionUseCase, ListFlowConnectionsUseCase, DeleteFlowConnectionUseCase,
} from '../../application/use-cases/flow/flow-connections.use-cases.js';
import { FLOW_TEMPLATES } from '../../application/use-cases/flow/flow-templates.js';
import { SimulateFlowUseCase } from '../../application/use-cases/flow/simulator/simulate-flow.use-case.js';
import { SetupAssistantUseCase } from '../../application/use-cases/flow/assistant/setup-assistant.use-case.js';
import { ListWhatsAppFlowsUseCase } from '../../application/use-cases/flow/list-whatsapp-flows.use-case.js';
import { FlowInvalidGraphError, DomainError } from '../../domain/errors/domain-errors.js';
import { FlowExecutionStatus } from '../../domain/enums/flow-execution-status.enum.js';
import { isTrigger } from '../../application/use-cases/flow/engine/flow-node-types.js';
import type { FlowGraph } from '../../domain/entities/flow.entity.js';

/** Líneas sobre las que actúa el disparador. Vacío = todas las del tenant. */
function triggerPhoneNumberIds(graph: FlowGraph): string[] {
  const data = graph.nodes.find((n) => isTrigger(n.type))?.data as Record<string, any> | undefined;
  if (!data) return [];
  if (Array.isArray(data.phoneNumberIds)) return data.phoneNumberIds.map(String);
  return data.phoneNumberId ? [String(data.phoneNumberId)] : [];
}

function throwMapped(error: DomainError): never {
  if (error instanceof FlowInvalidGraphError) {
    throw new UnprocessableEntityException({ message: error.message, errors: error.errors });
  }
  switch (error.code) {
    case 'FLOW_NOT_FOUND':
    case 'FLOW_EXECUTION_NOT_FOUND':
    case 'FLOW_CONNECTION_NOT_FOUND':
      throw new NotFoundException(error.message);
    case 'FLOW_INVALID_STATE':
    case 'FLOW_CONNECTION_IN_USE':
      throw new ConflictException(error.message);
    case 'PLAN_LIMIT_EXCEEDED':
      throw new ForbiddenException(error.message);
    default:
      throw new ConflictException(error.message);
  }
}

@ApiTags('Flows')
@ApiBearerAuth('JWT')
@Roles('admin')
@Controller('flows')
export class FlowController {
  constructor(
    @Inject('CreateFlowUseCase') private readonly createFlow: CreateFlowUseCase,
    @Inject('ListFlowsUseCase') private readonly listFlows: ListFlowsUseCase,
    @Inject('GetFlowUseCase') private readonly getFlow: GetFlowUseCase,
    @Inject('UpdateFlowUseCase') private readonly updateFlow: UpdateFlowUseCase,
    @Inject('PublishFlowUseCase') private readonly publishFlow: PublishFlowUseCase,
    @Inject('PauseFlowUseCase') private readonly pauseFlow: PauseFlowUseCase,
    @Inject('ActivateFlowUseCase') private readonly activateFlow: ActivateFlowUseCase,
    @Inject('ArchiveFlowUseCase') private readonly archiveFlow: ArchiveFlowUseCase,
    @Inject('RegenerateWebhookTokenUseCase') private readonly regenerateToken: RegenerateWebhookTokenUseCase,
    @Inject('ListFlowExecutionsUseCase') private readonly listExecutions: ListFlowExecutionsUseCase,
    @Inject('GetFlowStatsUseCase') private readonly getStats: GetFlowStatsUseCase,
    @Inject('GetFlowVersionsUseCase') private readonly getVersions: GetFlowVersionsUseCase,
    @Inject('GetFlowVersionUseCase') private readonly getVersion: GetFlowVersionUseCase,
    @Inject('SimulateFlowUseCase') private readonly simulateFlow: SimulateFlowUseCase,
    @Inject('SetupAssistantUseCase') private readonly setupAssistant: SetupAssistantUseCase,
    @Inject('ListWhatsAppFlowsUseCase') private readonly listWhatsAppFlows: ListWhatsAppFlowsUseCase,
  ) {}

  @Get('whatsapp-flows')
  @ApiOperation({
    summary: 'WhatsApp Flows of the account',
    description: 'Native forms built in WhatsApp Manager, read live from Meta so the node can pick one.',
  })
  async whatsappFlows(@CurrentAgent() agent: RequestAgent) {
    return { data: await this.listWhatsAppFlows.execute(agent.tenantId) };
  }

  @Get('templates')
  @ApiOperation({ summary: 'Flow template gallery' })
  templates() {
    return FLOW_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, graph: t.graph }));
  }

  @Get()
  @ApiOperation({ summary: 'List flows' })
  async list(@CurrentAgent() agent: RequestAgent) {
    const flows = await this.listFlows.execute(agent.tenantId);
    return flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      status: flow.status,
      publishedVersion: flow.publishedVersion,
      priority: flow.priority,
      stats: flow.stats,
      hasWebhookTrigger: !!flow.webhookToken,
      updatedAt: flow.updatedAt,
      // Para que la lista y la ficha del número puedan mostrar sobre qué
      // líneas actúa cada automatización sin abrir el canvas.
      defaultForPhoneNumberId: flow.defaultForPhoneNumberId,
      triggerPhoneNumberIds: triggerPhoneNumberIds(flow.draftGraph),
    }));
  }

  @Post()
  @ApiOperation({ summary: 'Create flow draft' })
  async create(
    @Body(new ZodValidationPipe(CreateFlowRequestSchema)) body: CreateFlowRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createFlow.execute({
      tenantId: agent.tenantId,
      createdByAgentId: agent._id,
      name: body.name,
      description: body.description,
      templateId: body.templateId,
      phoneScope: body.phoneScope,
      phoneNumberIds: body.phoneNumberIds,
    });
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Post('assistant-setup')
  @ApiOperation({
    summary: 'Guided setup: from a few closed answers to a live AI assistant + published flow',
  })
  async assistantSetup(
    @Body(new ZodValidationPipe(SetupAssistantRequestSchema)) body: SetupAssistantRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.setupAssistant.execute({
      ...body,
      tenantId: agent.tenantId,
      createdByAgentId: agent._id,
    });
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flow with draft graph and published version' })
  async get(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getFlow.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
    const { flow, publishedVersion } = result.value;
    const hasUnpublishedChanges = publishedVersion
      ? JSON.stringify(flow.draftGraph) !== JSON.stringify(publishedVersion.graph)
      : flow.draftGraph.nodes.length > 0;
    return { flow, publishedVersion, hasUnpublishedChanges };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update flow (autosave draft, rename, priority)' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFlowRequestSchema)) body: UpdateFlowRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateFlow.execute({
      tenantId: agent.tenantId,
      flowId: id,
      name: body.name,
      description: body.description,
      draftGraph: body.draftGraph as any,
      priority: body.priority,
    });
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Delete(':id')
  @DemoRestricted()
  @HttpCode(204)
  @ApiOperation({ summary: 'Archive flow (soft delete; cancels live executions)' })
  async archive(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.archiveFlow.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Validate and publish the draft graph as an immutable version' })
  async publish(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.publishFlow.execute(agent.tenantId, id, agent._id);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause flow (no new triggers; live executions continue)' })
  async pause(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.pauseFlow.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Re-activate a paused flow (last published version)' })
  async activate(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.activateFlow.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Post(':id/webhook-token')
  @ApiOperation({ summary: 'Regenerate the webhook trigger token' })
  async regenerateWebhookToken(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.regenerateToken.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Published version history' })
  async versions(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getVersions.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
    return result.value.map((v) => ({ id: v.id, version: v.version, publishedByAgentId: v.publishedByAgentId, createdAt: v.createdAt }));
  }

  @Post(':id/simulate')
  @ApiOperation({
    summary: 'Run the flow against a simulated customer, without sending real WhatsApp messages',
  })
  async simulate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SimulateFlowRequestSchema)) body: SimulateFlowRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.simulateFlow.execute({
      tenantId: agent.tenantId,
      flowId: id,
      source: body.source,
      session: (body.session ?? null) as any,
      text: body.text,
      optionId: body.optionId,
      location: body.location,
      flowResponse: body.flowResponse,
      httpResponse: body.httpResponse,
    });
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'Get one published version including its graph (preview / restore)' })
  async version(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.getVersion.execute(agent.tenantId, id, versionId);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Paginated executions of a flow' })
  async executions(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(FlowExecutionsQuerySchema)) query: FlowExecutionsQueryDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.listExecutions.execute(
      agent.tenantId,
      id,
      query.page,
      query.limit,
      query.status as FlowExecutionStatus | undefined,
    );
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Per-node funnel stats (aggregated daily counters)' })
  async stats(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(FlowStatsQuerySchema)) query: FlowStatsQueryDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.getStats.execute(agent.tenantId, id, query.days);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }
}

@ApiTags('Flows')
@ApiBearerAuth('JWT')
@Roles('admin')
@Controller('flow-executions')
export class FlowExecutionController {
  constructor(
    @Inject('GetFlowExecutionUseCase') private readonly getExecution: GetFlowExecutionUseCase,
    @Inject('CancelFlowExecutionUseCase') private readonly cancelExecution: CancelFlowExecutionUseCase,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Execution detail with step log and captured variables' })
  async get(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getExecution.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  // El botón "Detener flujo" del inbox lo usa cualquier agente que atiende la
  // conversación, no solo admins (el use case ya valida el tenant).
  @Post(':id/cancel')
  @Roles('admin', 'agent')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel a live execution (also used by the inbox "stop flow" button)' })
  async cancel(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.cancelExecution.execute(agent.tenantId, id, agent._id);
    if (!result.ok) throwMapped(result.error);
  }
}

@ApiTags('Flows')
@ApiBearerAuth('JWT')
@Roles('admin')
@Controller('flow-connections')
export class FlowConnectionController {
  constructor(
    @Inject('CreateFlowConnectionUseCase') private readonly createConnection: CreateFlowConnectionUseCase,
    @Inject('ListFlowConnectionsUseCase') private readonly listConnections: ListFlowConnectionsUseCase,
    @Inject('DeleteFlowConnectionUseCase') private readonly deleteConnection: DeleteFlowConnectionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List connections (secrets are never returned)' })
  async list(@CurrentAgent() agent: RequestAgent) {
    return this.listConnections.execute(agent.tenantId);
  }

  @Post()
  @DemoRestricted()
  @ApiOperation({ summary: 'Create a connection (secret is write-only)' })
  async create(
    @Body(new ZodValidationPipe(CreateFlowConnectionRequestSchema)) body: CreateFlowConnectionRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createConnection.execute(agent.tenantId, body.name, body.headerName, body.secret);
    if (!result.ok) throwMapped(result.error);
    return result.value;
  }

  @Delete(':id')
  @DemoRestricted()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a connection (409 if referenced by a published flow)' })
  async remove(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteConnection.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
  }
}
