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
import { GetConversationEventsUseCase } from '../../application/use-cases/conversation/get-conversation-events.use-case.js';
import { AddConversationNoteUseCase } from '../../application/use-cases/conversation/add-conversation-note.use-case.js';
import { GetConversationNotesUseCase } from '../../application/use-cases/conversation/get-conversation-notes.use-case.js';
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
import { AddNoteRequestSchema } from '../request-dtos/add-note-request.dto.js';
import type { AddNoteRequestDto } from '../request-dtos/add-note-request.dto.js';
import { DomainError } from '../../domain/errors/domain-errors.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';
import type { AgentRepository } from '../../domain/repositories/agent.repository.js';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';

@Controller('conversations')
export class ConversationController {
  constructor(
    @Inject('ListConversationsUseCase') private readonly listConversations: ListConversationsUseCase,
    @Inject('GetConversationDetailUseCase') private readonly getDetail: GetConversationDetailUseCase,
    @Inject('GetConversationMessagesUseCase') private readonly getMessages: GetConversationMessagesUseCase,
    @Inject('SendMessageUseCase') private readonly sendMessage: SendMessageUseCase,
    @Inject('AssignConversationUseCase') private readonly assignConversation: AssignConversationUseCase,
    @Inject('ResolveConversationUseCase') private readonly resolveConversation: ResolveConversationUseCase,
    @Inject('GetConversationEventsUseCase') private readonly getConversationEvents: GetConversationEventsUseCase,
    @Inject('AddConversationNoteUseCase') private readonly addNote: AddConversationNoteUseCase,
    @Inject('GetConversationNotesUseCase') private readonly getNotes: GetConversationNotesUseCase,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
    @Inject('AgentRepository') private readonly agentRepo: AgentRepository,
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
  ) {}

  @Get()
  async list(@Query(new ZodValidationPipe(ConversationQueryParamsSchema)) query: ConversationQueryParamsDto, @CurrentAgent() agent: RequestAgent) {
    // Agent sees own + unassigned; admin sees all
    const filters = {
      ...query,
      tenantId: agent.tenantId,
      ...(agent.role !== 'admin' && !query.agentId ? { agentId: agent._id } : {}),
    };
    const result = await this.listConversations.execute(filters);

    // Batch-lookup agent names and phone labels
    const agentIds = [...new Set(result.data.map((c) => c.agentId).filter(Boolean))] as string[];
    const phoneIds = [...new Set(result.data.map((c) => c.phoneNumberId))] as string[];
    const [agents, phones] = await Promise.all([
      Promise.all(agentIds.map((id) => this.agentRepo.findById(id))),
      Promise.all(phoneIds.map((id) => this.phoneRepo.findById(id))),
    ]);
    const agentMap = new Map(agents.filter(Boolean).map((a) => [a!.id, a!.name]));
    const phoneMap = new Map(phones.filter(Boolean).map((p) => [p!.id, { label: p!.label, displayPhone: p!.displayPhone }]));

    // Enrich conversations
    const enriched = await Promise.all(
      result.data.map(async (conv) => {
        const contact = await this.contactRepo.findById(conv.contactId);
        const phoneInfo = phoneMap.get(conv.phoneNumberId);
        return {
          ...conv,
          contact: contact
            ? { name: contact.name, phone: contact.phone, waId: contact.waId, profilePicUrl: contact.profilePicUrl }
            : null,
          agentName: conv.agentId ? (agentMap.get(conv.agentId) ?? null) : null,
          phoneLabel: phoneInfo?.label ?? null,
          phoneDisplay: phoneInfo?.displayPhone ?? null,
        };
      }),
    );

    return { ...result, data: enriched };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const result = await this.getDetail.execute(id);
    if (!result.ok) throw new NotFoundException(result.error.message);
    const contact = await this.contactRepo.findById(result.value.contactId);
    const agent = result.value.agentId ? await this.agentRepo.findById(result.value.agentId) : null;
    const phone = await this.phoneRepo.findById(result.value.phoneNumberId);
    return {
      ...result.value,
      contact: contact
        ? {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            waId: contact.waId,
            profilePicUrl: contact.profilePicUrl,
            email: contact.email,
            company: contact.company,
            notes: contact.notes,
          }
        : null,
      agentName: agent?.name ?? null,
      phoneLabel: phone?.label ?? null,
      phoneDisplay: phone?.displayPhone ?? null,
    };
  }

  @Get(':id/events')
  async events(@Param('id') id: string) {
    return this.getConversationEvents.execute(id);
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
  async send(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendMessageRequestSchema)) body: SendMessageRequestDto,
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

  @Get(':id/notes')
  async notes(@Param('id') id: string) {
    return this.getNotes.execute(id);
  }

  @Post(':id/notes')
  async addNoteToConversation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddNoteRequestSchema)) body: AddNoteRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.addNote.execute({
      conversationId: id,
      agentId: agent._id,
      tenantId: agent.tenantId,
      body: body.body,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Patch(':id/assign')
  @Roles('admin')
  async assign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignConversationRequestSchema)) body: AssignConversationRequestDto,
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
