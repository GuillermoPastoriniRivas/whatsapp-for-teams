import {
  Controller, Get, Post, Patch, Body, Param, Query,
  Inject, UsePipes, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ListConversationsUseCase } from '../../application/use-cases/conversation/list-conversations.use-case.js';
import { GetConversationDetailUseCase } from '../../application/use-cases/conversation/get-conversation-detail.use-case.js';
import { GetConversationMessagesUseCase } from '../../application/use-cases/conversation/get-conversation-messages.use-case.js';
import { SendMessageUseCase } from '../../application/use-cases/conversation/send-message.use-case.js';
import { AssignConversationUseCase } from '../../application/use-cases/conversation/assign-conversation.use-case.js';
import { ResolveConversationUseCase } from '../../application/use-cases/conversation/resolve-conversation.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { SendMessageRequestSchema } from '../request-dtos/send-message-request.dto.js';
import type { SendMessageRequestDto } from '../request-dtos/send-message-request.dto.js';
import { AssignConversationRequestSchema } from '../request-dtos/assign-conversation-request.dto.js';
import type { AssignConversationRequestDto } from '../request-dtos/assign-conversation-request.dto.js';
import { ConversationQueryParamsSchema } from '../request-dtos/conversation-query-params.dto.js';
import type { ConversationQueryParamsDto } from '../request-dtos/conversation-query-params.dto.js';
import { DomainError } from '../../domain/errors/domain-errors.js';

@Controller('conversations')
export class ConversationController {
  constructor(
    @Inject('ListConversationsUseCase') private readonly listConversations: ListConversationsUseCase,
    @Inject('GetConversationDetailUseCase') private readonly getDetail: GetConversationDetailUseCase,
    @Inject('GetConversationMessagesUseCase') private readonly getMessages: GetConversationMessagesUseCase,
    @Inject('SendMessageUseCase') private readonly sendMessage: SendMessageUseCase,
    @Inject('AssignConversationUseCase') private readonly assignConversation: AssignConversationUseCase,
    @Inject('ResolveConversationUseCase') private readonly resolveConversation: ResolveConversationUseCase,
  ) {}

  @Get()
  async list(@Query(new ZodValidationPipe(ConversationQueryParamsSchema)) query: ConversationQueryParamsDto, @CurrentAgent() agent: RequestAgent) {
    // Agent sees own + unassigned; admin sees all
    const filters = {
      ...query,
      tenantId: agent.tenantId,
      ...(agent.role !== 'admin' && !query.agentId ? { agentId: agent._id } : {}),
    };
    return this.listConversations.execute(filters);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const result = await this.getDetail.execute(id);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Get(':id/messages')
  async messages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.getMessages.execute({
      conversationId: id,
      page: Math.max(1, parseInt(page ?? '1', 10)),
      limit: Math.min(100, Math.max(1, parseInt(limit ?? '50', 10))),
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Post(':id/messages')
  @UsePipes(new ZodValidationPipe(SendMessageRequestSchema))
  async send(
    @Param('id') id: string,
    @Body() body: SendMessageRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.sendMessage.execute({
      conversationId: id,
      agentId: agent._id,
      tenantId: agent.tenantId,
      body: body.body,
      messageType: body.messageType,
    });
    if (!result.ok) {
      const error = result.error as DomainError;
      if (error.code === 'CONVERSATION_WINDOW_EXPIRED') throw new ForbiddenException(error.message);
      if (error.code === 'AGENT_NOT_ASSIGNED') throw new ForbiddenException(error.message);
      throw new NotFoundException(error.message);
    }
    return result.value;
  }

  @Patch(':id/assign')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(AssignConversationRequestSchema))
  async assign(
    @Param('id') id: string,
    @Body() body: AssignConversationRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.assignConversation.execute({
      conversationId: id,
      agentId: body.agentId,
      tenantId: agent.tenantId,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.resolveConversation.execute({
      conversationId: id,
      agentId: agent._id,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
