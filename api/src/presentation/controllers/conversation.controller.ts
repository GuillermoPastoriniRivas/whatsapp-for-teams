import {
  Controller, Get, Post, Patch, Body, Param, Query,
  Inject, UsePipes, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('Conversations')
@ApiBearerAuth('JWT')
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
  @ApiOperation({ summary: 'List conversations', description: 'List conversations with filtering and pagination. Agents see their own + unassigned; admins see all.' })
  @ApiQuery({ name: 'status', required: false, enum: ['unassigned', 'active', 'resolved'], description: 'Filter by conversation status' })
  @ApiQuery({ name: 'agentId', required: false, description: 'Filter by assigned agent ID' })
  @ApiQuery({ name: 'phoneNumberId', required: false, description: 'Filter by phone number ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated list of conversations with contact info' })
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
  @ApiOperation({ summary: 'Get conversation detail', description: 'Get full conversation details with contact and agent info' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation detail with enriched data' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
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
  @ApiOperation({ summary: 'Get conversation events', description: 'Get the event timeline for a conversation (assignments, status changes, etc.)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'List of conversation events' })
  async events(@Param('id') id: string) {
    return this.getConversationEvents.execute(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get conversation messages', description: 'Get paginated messages for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Messages per page (default: 50, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated messages' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
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
  @ApiOperation({ summary: 'Send message', description: 'Send a message in a conversation via WhatsApp' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['body'],
      properties: {
        body: { type: 'string', example: 'Hello! How can I help you?' },
        messageType: { type: 'string', enum: ['text', 'image', 'audio', 'video', 'document', 'location'], description: 'Defaults to text' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 403, description: 'Conversation window expired or agent not assigned' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
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
  @ApiOperation({ summary: 'Get conversation notes', description: 'Get internal notes for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'List of notes' })
  async notes(@Param('id') id: string) {
    return this.getNotes.execute(id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add note', description: 'Add an internal note to a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['body'],
      properties: {
        body: { type: 'string', maxLength: 2000, example: 'Customer requested callback tomorrow' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Note added' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
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
  @ApiOperation({ summary: 'Assign conversation', description: 'Assign a conversation to an agent (admin only)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string', description: 'ID of the agent to assign' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Conversation assigned' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Conversation or agent not found' })
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
  @ApiOperation({ summary: 'Resolve conversation', description: 'Mark a conversation as resolved' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation resolved' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async resolve(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.resolveConversation.execute({
      conversationId: id,
      agentId: agent._id,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
