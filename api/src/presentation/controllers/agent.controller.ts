import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
  Inject, UsePipes, ForbiddenException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CreateAgentUseCase } from '../../application/use-cases/agent/create-agent.use-case.js';
import { InviteAgentUseCase } from '../../application/use-cases/agent/invite-agent.use-case.js';
import { ListAgentsUseCase } from '../../application/use-cases/agent/list-agents.use-case.js';
import { UpdateAgentStatusUseCase } from '../../application/use-cases/agent/update-agent-status.use-case.js';
import { UpdateAgentProfileUseCase } from '../../application/use-cases/agent/update-agent-profile.use-case.js';
import { DeleteAgentUseCase } from '../../application/use-cases/agent/delete-agent.use-case.js';
import { GrantPhoneAccessUseCase } from '../../application/use-cases/agent/grant-phone-access.use-case.js';
import { RevokePhoneAccessUseCase } from '../../application/use-cases/agent/revoke-phone-access.use-case.js';
import { GetAgentPhoneAccessUseCase } from '../../application/use-cases/agent/get-agent-phone-access.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateAgentRequestSchema } from '../request-dtos/create-agent-request.dto.js';
import type { CreateAgentRequestDto } from '../request-dtos/create-agent-request.dto.js';
import { InviteAgentRequestSchema } from '../request-dtos/invite-agent-request.dto.js';
import type { InviteAgentRequestDto } from '../request-dtos/invite-agent-request.dto.js';
import { UpdateStatusRequestSchema } from '../request-dtos/update-status-request.dto.js';
import type { UpdateStatusRequestDto } from '../request-dtos/update-status-request.dto.js';
import { UpdateAgentProfileRequestSchema } from '../request-dtos/update-agent-profile-request.dto.js';
import type { UpdateAgentProfileRequestDto } from '../request-dtos/update-agent-profile-request.dto.js';
import { GrantPhoneAccessRequestSchema } from '../request-dtos/grant-phone-access-request.dto.js';
import type { GrantPhoneAccessRequestDto } from '../request-dtos/grant-phone-access-request.dto.js';
import { AgentStatus } from '../../domain/enums/agent-status.enum.js';
import { RequirePlanLimit } from '../decorators/require-plan-limit.decorator.js';
import { PlanLimitGuard } from '../guards/plan-limit.guard.js';

@ApiTags('Agents')
@ApiBearerAuth('JWT')
@Controller('agents')
export class AgentController {
  constructor(
    @Inject('CreateAgentUseCase') private readonly createAgent: CreateAgentUseCase,
    @Inject('ListAgentsUseCase') private readonly listAgents: ListAgentsUseCase,
    @Inject('UpdateAgentStatusUseCase') private readonly updateStatus: UpdateAgentStatusUseCase,
    @Inject('UpdateAgentProfileUseCase') private readonly updateProfile: UpdateAgentProfileUseCase,
    @Inject('DeleteAgentUseCase') private readonly deleteAgent: DeleteAgentUseCase,
    @Inject('GrantPhoneAccessUseCase') private readonly grantAccess: GrantPhoneAccessUseCase,
    @Inject('RevokePhoneAccessUseCase') private readonly revokeAccess: RevokePhoneAccessUseCase,
    @Inject('GetAgentPhoneAccessUseCase') private readonly getAccess: GetAgentPhoneAccessUseCase,
    @Inject('InviteAgentUseCase') private readonly inviteAgent: InviteAgentUseCase,
  ) {}

  @Post()
  @Roles('admin')
  @DemoRestricted()
  @UseGuards(PlanLimitGuard)
  @RequirePlanLimit('human_agents')
  @ApiOperation({ summary: 'Create agent', description: 'Create a new agent in the tenant (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', format: 'email', example: 'john@company.com' },
        password: { type: 'string', minLength: 6, example: 'securepass' },
        role: { type: 'string', enum: ['admin', 'agent'], description: 'Defaults to agent' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Agent created', schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'agent'] },
      status: { type: 'string', enum: ['available', 'busy', 'offline'] },
    },
  }})
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 409, description: 'Agent email already exists' })
  async create(@Body(new ZodValidationPipe(CreateAgentRequestSchema)) body: CreateAgentRequestDto, @CurrentAgent() agent: RequestAgent) {
    const result = await this.createAgent.execute({ ...body, tenantId: agent.tenantId });
    if (!result.ok) throw new ConflictException(result.error.message);
    const a = result.value;
    return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status };
  }

  @Post('invite')
  @Roles('admin')
  @DemoRestricted()
  @UseGuards(PlanLimitGuard)
  @RequirePlanLimit('human_agents')
  @ApiOperation({ summary: 'Invite agent', description: 'Invite a new agent via email. They will receive a link to set their password.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', example: 'Jane Doe' },
        email: { type: 'string', format: 'email', example: 'jane@company.com' },
        role: { type: 'string', enum: ['admin', 'agent'], description: 'Defaults to agent' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Agent created and invitation email sent' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 409, description: 'Agent email already exists' })
  async invite(@Body(new ZodValidationPipe(InviteAgentRequestSchema)) body: InviteAgentRequestDto, @CurrentAgent() agent: RequestAgent) {
    const currentAgent = await this.listAgents.execute(agent.tenantId);
    const inviter = currentAgent.find(a => a.id === agent._id);
    const result = await this.inviteAgent.execute({
      name: body.name,
      email: body.email,
      role: body.role as any,
      tenantId: agent.tenantId,
      inviterName: inviter?.name ?? 'Admin',
    });
    if (!result.ok) throw new ConflictException(result.error.message);
    const a = result.value;
    return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status };
  }

  @Get()
  @ApiOperation({ summary: 'List agents', description: 'List all agents in the tenant, optionally filtered by status' })
  @ApiQuery({ name: 'status', required: false, enum: ['available', 'busy', 'offline'], description: 'Filter by agent status' })
  @ApiResponse({ status: 200, description: 'List of agents' })
  async list(@CurrentAgent() agent: RequestAgent, @Query('status') status?: AgentStatus) {
    return this.listAgents.execute(agent.tenantId, status);
  }

  @Patch(':id')
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({ summary: 'Update agent profile', description: 'Update agent name and/or role (admin only)' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Jane Doe' },
        role: { type: 'string', enum: ['admin', 'agent'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated agent' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async patchProfile(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAgentProfileRequestSchema)) body: UpdateAgentProfileRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateProfile.execute({
      agentId: id,
      tenantId: agent.tenantId,
      name: body.name,
      role: body.role,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    const a = result.value;
    return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status };
  }

  @Delete(':id')
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({ summary: 'Delete agent', description: 'Delete an agent from the tenant (admin only)' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent deleted' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async remove(
    @Param('id') id: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.deleteAgent.execute({
      agentId: id,
      tenantId: agent.tenantId,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return { deleted: true };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update agent status', description: 'Change agent availability status. Agents can change their own; admins can change any.' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['available', 'busy', 'offline'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated agent' })
  @ApiResponse({ status: 403, description: 'Cannot change another agent\'s status' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStatusRequestSchema)) body: UpdateStatusRequestDto,
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
  @DemoRestricted()
  @ApiOperation({ summary: 'Grant phone access', description: 'Grant an agent access to a phone number (admin only)' })
  @ApiParam({ name: 'agentId', description: 'Agent ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['phoneNumberId'],
      properties: {
        phoneNumberId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Access granted' })
  @ApiResponse({ status: 404, description: 'Agent or phone number not found' })
  @ApiResponse({ status: 409, description: 'Access already exists' })
  async grantPhoneAccess(
    @Param('agentId') agentId: string,
    @Body(new ZodValidationPipe(GrantPhoneAccessRequestSchema)) body: GrantPhoneAccessRequestDto,
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
  @DemoRestricted()
  @ApiOperation({ summary: 'Revoke phone access', description: 'Revoke an agent\'s access to a phone number (admin only)' })
  @ApiParam({ name: 'agentId', description: 'Agent ID' })
  @ApiParam({ name: 'phoneNumberId', description: 'Phone number ID' })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  async revokePhoneAccess(
    @Param('agentId') agentId: string,
    @Param('phoneNumberId') phoneNumberId: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    await this.revokeAccess.execute({ agentId, phoneNumberId, tenantId: agent.tenantId });
  }

  @Get(':agentId/phone-access')
  @ApiOperation({ summary: 'Get phone access list', description: 'List phone numbers an agent has access to' })
  @ApiParam({ name: 'agentId', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'List of phone access entries' })
  async getPhoneAccess(@Param('agentId') agentId: string) {
    return this.getAccess.execute(agentId);
  }
}
