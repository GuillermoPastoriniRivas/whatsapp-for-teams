import {
  Controller, Get, Post, Patch, Body, Param,
  Inject, UseGuards, HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator.js';
import { ApiKeyGuard } from '../guards/api-key.guard.js';
import { ApiPrincipal } from '../decorators/api-principal.decorator.js';
import type { ApiKeyPrincipal } from '../decorators/api-principal.decorator.js';
import { RequireScopes } from '../decorators/require-scopes.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateFlowRequestSchema, UpdateFlowRequestSchema, SimulateFlowRequestSchema,
} from '../request-dtos/flow-request.dto.js';
import type {
  CreateFlowRequestDto, UpdateFlowRequestDto, SimulateFlowRequestDto,
} from '../request-dtos/flow-request.dto.js';
import { CreateFlowUseCase } from '../../application/use-cases/flow/create-flow.use-case.js';
import { ListFlowsUseCase } from '../../application/use-cases/flow/list-flows.use-case.js';
import { GetFlowUseCase } from '../../application/use-cases/flow/get-flow.use-case.js';
import { UpdateFlowUseCase } from '../../application/use-cases/flow/update-flow.use-case.js';
import { CheckFlowUseCase } from '../../application/use-cases/flow/check-flow.use-case.js';
import { GetFlowVersionsUseCase } from '../../application/use-cases/flow/flow-executions.use-cases.js';
import { SimulateFlowUseCase } from '../../application/use-cases/flow/simulator/simulate-flow.use-case.js';
import { NODE_TYPES, TRIGGER_TYPES, outputHandles, isTrigger, isTerminal } from '../../application/use-cases/flow/engine/flow-node-types.js';
import type { AgentRepository } from '../../domain/repositories/agent.repository.js';
import { AgentType } from '../../domain/enums/agent-type.enum.js';
import { DomainError } from '../../domain/errors/domain-errors.js';

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  FLOW_NOT_FOUND: 404,
  FLOW_INVALID_GRAPH: 422,
  FLOW_INVALID_STATE: 409,
  PLAN_LIMIT_EXCEEDED: 403,
  FEATURE_NOT_IN_PLAN: 403,
};

const DYNAMIC_OUTPUT_TYPES = new Set(['action.send_buttons', 'action.send_list', 'logic.ai_route']);

/**
 * Construir automatizaciones desde afuera. Publicar NO está acá a propósito: un
 * flujo publicado le habla a gente real desde el número del cliente, así que esa
 * decisión queda del lado humano. Probar se hace en el simulador, que no manda
 * ningún mensaje.
 */
@ApiTags('Public API (v1) · Flows')
@ApiSecurity('ApiKey')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1/flows')
export class PublicFlowsController {
  constructor(
    @Inject('CreateFlowUseCase') private readonly createFlow: CreateFlowUseCase,
    @Inject('ListFlowsUseCase') private readonly listFlows: ListFlowsUseCase,
    @Inject('GetFlowUseCase') private readonly getFlow: GetFlowUseCase,
    @Inject('UpdateFlowUseCase') private readonly updateFlow: UpdateFlowUseCase,
    @Inject('CheckFlowUseCase') private readonly checkFlow: CheckFlowUseCase,
    @Inject('GetFlowVersionsUseCase') private readonly getVersions: GetFlowVersionsUseCase,
    @Inject('SimulateFlowUseCase') private readonly simulateFlow: SimulateFlowUseCase,
    @Inject('AgentRepository') private readonly agentRepo: AgentRepository,
  ) {}

  /**
   * Un flujo siempre tiene autor humano. El de una clave es quien la creó; si
   * esa persona ya no está, queda a nombre de un admin de la cuenta.
   */
  private async authorFor(principal: ApiKeyPrincipal): Promise<string | null> {
    if (principal.createdByAgentId) return principal.createdByAgentId;
    const agents = await this.agentRepo.findByTenantId(principal.tenantId);
    const admin = agents.find((agent) => agent.role === 'admin' && agent.type === AgentType.HUMAN);
    return admin?.id ?? agents.find((agent) => agent.type === AgentType.HUMAN)?.id ?? null;
  }

  private fail(error: DomainError): never {
    const body: Record<string, unknown> = { code: error.code, message: error.message };
    if (error.code === 'FLOW_INVALID_GRAPH') body.errors = (error as { errors?: unknown }).errors;
    throw new HttpException(body, DOMAIN_ERROR_STATUS[error.code] ?? 400);
  }

  @Get('node-types')
  @RequireScopes('flows:read')
  @ApiOperation({
    summary: 'Node catalog',
    description: 'Every node type the engine accepts, with the output handles an edge can start from.',
  })
  nodeTypes() {
    return {
      data: NODE_TYPES.map((type) => ({
        type,
        trigger: isTrigger(type),
        terminal: isTerminal(type),
        outputs: outputHandles({ id: 'sample', type, position: { x: 0, y: 0 }, data: {} } as never),
        dynamicOutputs: DYNAMIC_OUTPUT_TYPES.has(type),
      })),
      triggers: [...TRIGGER_TYPES],
    };
  }

  @Get()
  @RequireScopes('flows:read')
  @ApiOperation({ summary: 'List flows' })
  async list(@ApiPrincipal() principal: ApiKeyPrincipal) {
    const flows = await this.listFlows.execute(principal.tenantId);
    return {
      data: flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        status: flow.status,
        publishedVersion: flow.publishedVersion,
        priority: flow.priority,
        updatedAt: flow.updatedAt,
      })),
    };
  }

  @Post()
  @RequireScopes('flows:write')
  @ApiOperation({ summary: 'Create a flow draft', description: 'The draft is never live: publishing stays in the app.' })
  async create(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Body(new ZodValidationPipe(CreateFlowRequestSchema)) body: CreateFlowRequestDto,
  ) {
    const author = await this.authorFor(principal);
    if (!author) {
      throw new HttpException(
        { code: 'NO_AUTHOR', message: 'The account has no human agent to attribute the flow to.' },
        409,
      );
    }

    const result = await this.createFlow.execute({
      tenantId: principal.tenantId,
      createdByAgentId: author,
      name: body.name,
      description: body.description,
      templateId: body.templateId,
      phoneScope: body.phoneScope,
      phoneNumberIds: body.phoneNumberIds,
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Get(':id')
  @RequireScopes('flows:read')
  @ApiOperation({ summary: 'Get a flow with its draft graph' })
  async get(@ApiPrincipal() principal: ApiKeyPrincipal, @Param('id') id: string) {
    const result = await this.getFlow.execute(principal.tenantId, id);
    if (!result.ok) this.fail(result.error);
    const { flow, publishedVersion } = result.value;
    return {
      flow: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        status: flow.status,
        draftGraph: flow.draftGraph,
        publishedVersion: flow.publishedVersion,
      },
      publishedVersion: publishedVersion ? { id: publishedVersion.id, version: publishedVersion.version } : null,
    };
  }

  @Patch(':id')
  @RequireScopes('flows:write')
  @ApiOperation({ summary: 'Replace the draft graph, rename or reprioritise' })
  async update(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFlowRequestSchema)) body: UpdateFlowRequestDto,
  ) {
    const result = await this.updateFlow.execute({
      tenantId: principal.tenantId,
      flowId: id,
      name: body.name,
      description: body.description,
      draftGraph: body.draftGraph as never,
      priority: body.priority,
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Post(':id/check')
  @RequireScopes('flows:read')
  @ApiOperation({
    summary: 'Validate the draft',
    description: 'Runs the same rules as publishing, without publishing. Use it to fix a draft before a human sees it.',
  })
  async check(@ApiPrincipal() principal: ApiKeyPrincipal, @Param('id') id: string) {
    const result = await this.checkFlow.execute(principal.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Post(':id/simulate')
  @RequireScopes('flows:write')
  @ApiOperation({
    summary: 'Run the flow against a simulated customer',
    description: 'Nothing is sent: no WhatsApp messages, no webhooks, no HTTP calls to your systems.',
  })
  async simulate(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SimulateFlowRequestSchema)) body: SimulateFlowRequestDto,
  ) {
    const result = await this.simulateFlow.execute({
      tenantId: principal.tenantId,
      flowId: id,
      source: body.source,
      session: (body.session ?? null) as never,
      text: body.text,
      optionId: body.optionId,
      location: body.location,
      flowResponse: body.flowResponse,
      httpResponse: body.httpResponse,
    });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Get(':id/versions')
  @RequireScopes('flows:read')
  @ApiOperation({ summary: 'Published version history' })
  async versions(@ApiPrincipal() principal: ApiKeyPrincipal, @Param('id') id: string) {
    const result = await this.getVersions.execute(principal.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return { data: result.value.map((version) => ({ id: version.id, version: version.version, createdAt: version.createdAt })) };
  }
}
