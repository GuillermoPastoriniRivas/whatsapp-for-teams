import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
  Inject, NotFoundException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { CreateAiAgentUseCase } from '../../application/use-cases/ai/create-ai-agent.use-case.js';
import { GetAiAgentUseCase } from '../../application/use-cases/ai/get-ai-agent.use-case.js';
import { ListAiAgentsUseCase } from '../../application/use-cases/ai/list-ai-agents.use-case.js';
import { UpdateAiAgentConfigUseCase } from '../../application/use-cases/ai/update-ai-agent-config.use-case.js';
import { DeleteAiAgentUseCase } from '../../application/use-cases/ai/delete-ai-agent.use-case.js';
import { PlaygroundChatUseCase } from '../../application/use-cases/ai/playground-chat.use-case.js';
import type { AgentRepository } from '../../domain/repositories/agent.repository.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateAiAgentRequestSchema } from '../request-dtos/create-ai-agent-request.dto.js';
import type { CreateAiAgentRequestDto } from '../request-dtos/create-ai-agent-request.dto.js';
import { UpdateAiAgentConfigRequestSchema } from '../request-dtos/update-ai-agent-config-request.dto.js';
import type { UpdateAiAgentConfigRequestDto } from '../request-dtos/update-ai-agent-config-request.dto.js';
import { RequirePlanLimit } from '../decorators/require-plan-limit.decorator.js';
import { PlanLimitGuard } from '../guards/plan-limit.guard.js';

const PlaygroundRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })).min(1).max(50),
});
type PlaygroundRequestDto = z.infer<typeof PlaygroundRequestSchema>;

@ApiTags('AI Agents')
@ApiBearerAuth('JWT')
@Controller('ai-agents')
export class AiAgentController {
  constructor(
    @Inject('CreateAiAgentUseCase') private readonly createAiAgent: CreateAiAgentUseCase,
    @Inject('GetAiAgentUseCase') private readonly getAiAgent: GetAiAgentUseCase,
    @Inject('ListAiAgentsUseCase') private readonly listAiAgents: ListAiAgentsUseCase,
    @Inject('UpdateAiAgentConfigUseCase') private readonly updateAiAgent: UpdateAiAgentConfigUseCase,
    @Inject('DeleteAiAgentUseCase') private readonly deleteAiAgent: DeleteAiAgentUseCase,
    @Inject('PlaygroundChatUseCase') private readonly playgroundChat: PlaygroundChatUseCase,
    @Inject('AgentRepository') private readonly agentRepo: AgentRepository,
  ) {}

  @Post()
  @Roles('admin')
  @UseGuards(PlanLimitGuard)
  @RequirePlanLimit('ai_bots')
  @ApiOperation({ summary: 'Create AI agent', description: 'Create a new AI agent from a structured business profile (admin only)' })
  @ApiResponse({ status: 201, description: 'AI agent created' })
  async create(
    @Body(new ZodValidationPipe(CreateAiAgentRequestSchema)) body: CreateAiAgentRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createAiAgent.execute({ ...body, tenantId: agent.tenantId });
    if (!result.ok) throw new NotFoundException(result.error.message);

    const { agent: aiAgent, config } = result.value;
    return {
      id: aiAgent.id,
      name: aiAgent.name,
      type: aiAgent.type,
      status: aiAgent.status,
      config,
    };
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List AI agents', description: 'List all AI agents for the tenant' })
  @ApiResponse({ status: 200, description: 'List of AI agents' })
  async list(@CurrentAgent() agent: RequestAgent) {
    const results = await this.listAiAgents.execute(agent.tenantId);
    return results.map(({ agent: aiAgent, config }) => ({
      id: aiAgent.id,
      name: aiAgent.name,
      type: aiAgent.type,
      status: aiAgent.status,
      activeCount: aiAgent.activeCount,
      config,
    }));
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get AI agent', description: 'Get AI agent details with configuration' })
  @ApiParam({ name: 'id', description: 'AI Agent ID' })
  @ApiResponse({ status: 200, description: 'AI agent details' })
  @ApiResponse({ status: 404, description: 'AI agent not found' })
  async get(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getAiAgent.execute(id, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);

    const { agent: aiAgent, config } = result.value;
    return {
      id: aiAgent.id,
      name: aiAgent.name,
      type: aiAgent.type,
      status: aiAgent.status,
      activeCount: aiAgent.activeCount,
      config,
    };
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update AI agent', description: 'Update AI agent configuration' })
  @ApiParam({ name: 'id', description: 'AI Agent ID' })
  @ApiResponse({ status: 200, description: 'Updated AI agent config' })
  @ApiResponse({ status: 404, description: 'AI agent not found' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAiAgentConfigRequestSchema)) body: UpdateAiAgentConfigRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    // Update agent name if provided
    if (body.name) {
      await this.agentRepo.updateName(id, body.name);
    }

    const { name, ...configUpdate } = body;
    const result = await this.updateAiAgent.execute(id, agent.tenantId, configUpdate as any);
    if (!result.ok) throw new NotFoundException(result.error.message);

    return { config: result.value };
  }

  @Delete(':id')
  @Roles('admin')
  @DemoRestricted()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete AI agent', description: 'Deactivate and remove AI agent' })
  @ApiParam({ name: 'id', description: 'AI Agent ID' })
  @ApiResponse({ status: 204, description: 'AI agent deleted' })
  @ApiResponse({ status: 404, description: 'AI agent not found' })
  async delete(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteAiAgent.execute(id, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
  }

  @Post(':id/playground')
  @Roles('admin')
  @ApiOperation({ summary: 'Playground chat', description: 'Test the bot with the real production prompt, without touching WhatsApp' })
  @ApiParam({ name: 'id', description: 'AI Agent ID' })
  @ApiResponse({ status: 200, description: 'Bot reply bubbles' })
  async playground(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PlaygroundRequestSchema)) body: PlaygroundRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.playgroundChat.execute({
      agentId: id,
      tenantId: agent.tenantId,
      messages: body.messages,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);

    return result.value;
  }
}
