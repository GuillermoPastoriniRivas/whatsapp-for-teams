import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Inject, NotFoundException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { CreateAiAgentUseCase } from '../../application/use-cases/ai/create-ai-agent.use-case.js';
import { GetAiAgentUseCase } from '../../application/use-cases/ai/get-ai-agent.use-case.js';
import { ListAiAgentsUseCase } from '../../application/use-cases/ai/list-ai-agents.use-case.js';
import { UpdateAiAgentConfigUseCase } from '../../application/use-cases/ai/update-ai-agent-config.use-case.js';
import { DeleteAiAgentUseCase } from '../../application/use-cases/ai/delete-ai-agent.use-case.js';
import type { AiCompletionPort } from '../../application/ports/ai-completion.port.js';
import type { AiAgentConfigRepository } from '../../domain/repositories/ai-agent-config.repository.js';
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
    @Inject('AiCompletionPort') private readonly aiCompletion: AiCompletionPort,
    @Inject('AiAgentConfigRepository') private readonly configRepo: AiAgentConfigRepository,
    @Inject('AgentRepository') private readonly agentRepo: AgentRepository,
  ) {}

  @Post()
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({ summary: 'Create AI agent', description: 'Create a new AI agent with LLM configuration (admin only)' })
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
      config: this.sanitizeConfig(config),
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
      config: this.sanitizeConfig(config),
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
      config: this.sanitizeConfig(config),
    };
  }

  @Patch(':id')
  @Roles('admin')
  @DemoRestricted()
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

    return { config: this.sanitizeConfig(result.value) };
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

  @Post(':id/test')
  @Roles('admin')
  @ApiOperation({ summary: 'Test AI agent', description: 'Send a test message and get AI response' })
  @ApiParam({ name: 'id', description: 'AI Agent ID' })
  @ApiResponse({ status: 200, description: 'Test response' })
  async test(
    @Param('id') id: string,
    @Body() body: { message: string },
    @CurrentAgent() agent: RequestAgent,
  ) {
    const config = await this.configRepo.findByAgentId(id);
    if (!config || config.tenantId !== agent.tenantId) {
      throw new NotFoundException('AI agent not found');
    }

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[now.getDay()];

    let systemPrompt = '';
    systemPrompt += `Current datetime: ${dayName}, ${now.toISOString().slice(0, 10)}.\n\n`;
    if (config.persona.role) systemPrompt += `You are ${config.persona.role}.\n`;
    if (config.persona.tone) systemPrompt += `Tone: ${config.persona.tone}.\n`;
    if (config.persona.language) systemPrompt += `Respond in: ${config.persona.language}.\n`;
    if (config.persona.instructions) systemPrompt += `\n${config.persona.instructions}\n`;
    if (config.systemPrompt) systemPrompt += `\n${config.systemPrompt}\n`;
    if (config.knowledgeBase) systemPrompt += `\n--- Business Knowledge ---\n${config.knowledgeBase}\n--- End Knowledge ---\n`;

    const result = await this.aiCompletion.complete({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      systemPrompt,
      messages: [{ role: 'user', content: body.message }],
    });

    return {
      response: result.content,
      tokensUsed: result.tokensUsed,
    };
  }

  private sanitizeConfig(config: any) {
    const { apiKey, ...rest } = config;
    return {
      ...rest,
      apiKeySet: !!apiKey,
    };
  }
}
