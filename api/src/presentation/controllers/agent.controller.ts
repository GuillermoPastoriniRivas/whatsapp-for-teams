import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Inject, UsePipes, ForbiddenException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { CreateAgentUseCase } from '../../application/use-cases/agent/create-agent.use-case.js';
import { ListAgentsUseCase } from '../../application/use-cases/agent/list-agents.use-case.js';
import { UpdateAgentStatusUseCase } from '../../application/use-cases/agent/update-agent-status.use-case.js';
import { GrantPhoneAccessUseCase } from '../../application/use-cases/agent/grant-phone-access.use-case.js';
import { RevokePhoneAccessUseCase } from '../../application/use-cases/agent/revoke-phone-access.use-case.js';
import { GetAgentPhoneAccessUseCase } from '../../application/use-cases/agent/get-agent-phone-access.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateAgentRequestSchema } from '../request-dtos/create-agent-request.dto.js';
import type { CreateAgentRequestDto } from '../request-dtos/create-agent-request.dto.js';
import { UpdateStatusRequestSchema } from '../request-dtos/update-status-request.dto.js';
import type { UpdateStatusRequestDto } from '../request-dtos/update-status-request.dto.js';
import { GrantPhoneAccessRequestSchema } from '../request-dtos/grant-phone-access-request.dto.js';
import type { GrantPhoneAccessRequestDto } from '../request-dtos/grant-phone-access-request.dto.js';
import { AgentStatus } from '../../domain/enums/agent-status.enum.js';

@Controller('agents')
export class AgentController {
  constructor(
    @Inject('CreateAgentUseCase') private readonly createAgent: CreateAgentUseCase,
    @Inject('ListAgentsUseCase') private readonly listAgents: ListAgentsUseCase,
    @Inject('UpdateAgentStatusUseCase') private readonly updateStatus: UpdateAgentStatusUseCase,
    @Inject('GrantPhoneAccessUseCase') private readonly grantAccess: GrantPhoneAccessUseCase,
    @Inject('RevokePhoneAccessUseCase') private readonly revokeAccess: RevokePhoneAccessUseCase,
    @Inject('GetAgentPhoneAccessUseCase') private readonly getAccess: GetAgentPhoneAccessUseCase,
  ) {}

  @Post()
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(CreateAgentRequestSchema))
  async create(@Body() body: CreateAgentRequestDto, @CurrentAgent() agent: RequestAgent) {
    const result = await this.createAgent.execute({ ...body, tenantId: agent.tenantId });
    if (!result.ok) throw new ConflictException(result.error.message);
    const a = result.value;
    return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status };
  }

  @Get()
  async list(@CurrentAgent() agent: RequestAgent, @Query('status') status?: AgentStatus) {
    return this.listAgents.execute(agent.tenantId, status);
  }

  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(UpdateStatusRequestSchema))
  async changeStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    // Agent can change own status; admin can change any
    if (agent.role !== 'admin' && agent._id !== id) {
      throw new ForbiddenException('You can only change your own status');
    }
    const result = await this.updateStatus.execute({
      agentId: id,
      tenantId: agent.tenantId,
      status: body.status,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Post(':agentId/phone-access')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(GrantPhoneAccessRequestSchema))
  async grantPhoneAccess(
    @Param('agentId') agentId: string,
    @Body() body: GrantPhoneAccessRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.grantAccess.execute({
      agentId,
      phoneNumberId: body.phoneNumberId,
      tenantId: agent.tenantId,
    });
    if (!result.ok) {
      if (result.error.code === 'PHONE_ACCESS_ALREADY_EXISTS') throw new ConflictException(result.error.message);
      throw new NotFoundException(result.error.message);
    }
    return result.value;
  }

  @Delete(':agentId/phone-access/:phoneNumberId')
  @Roles('admin')
  async revokePhoneAccess(
    @Param('agentId') agentId: string,
    @Param('phoneNumberId') phoneNumberId: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    await this.revokeAccess.execute({ agentId, phoneNumberId, tenantId: agent.tenantId });
  }

  @Get(':agentId/phone-access')
  async getPhoneAccess(@Param('agentId') agentId: string) {
    return this.getAccess.execute(agentId);
  }
}
