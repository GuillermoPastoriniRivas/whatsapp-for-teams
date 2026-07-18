import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Inject, UsePipes, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ListConversationsUseCase } from '../../application/use-cases/conversation/list-conversations.use-case.js';
import { GetConversationDetailUseCase } from '../../application/use-cases/conversation/get-conversation-detail.use-case.js';
import { GetConversationMessagesUseCase } from '../../application/use-cases/conversation/get-conversation-messages.use-case.js';
import { SendMessageUseCase } from '../../application/use-cases/conversation/send-message.use-case.js';
import { AssignConversationUseCase } from '../../application/use-cases/conversation/assign-conversation.use-case.js';
import { GetConversationEventsUseCase } from '../../application/use-cases/conversation/get-conversation-events.use-case.js';
import { AddConversationNoteUseCase } from '../../application/use-cases/conversation/add-conversation-note.use-case.js';
import { GetConversationNotesUseCase } from '../../application/use-cases/conversation/get-conversation-notes.use-case.js';
import { AssignLabelUseCase } from '../../application/use-cases/label/assign-label.use-case.js';
import { RemoveLabelUseCase } from '../../application/use-cases/label/remove-label.use-case.js';
import { GetConversationLabelsUseCase } from '../../application/use-cases/label/get-conversation-labels.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { SendMessageRequestSchema } from '../request-dtos/send-message-request.dto.js';
import type { SendMessageRequestDto } from '../request-dtos/send-message-request.dto.js';
import { SendTemplateMessageUseCase } from '../../application/use-cases/conversation/send-template-message.use-case.js';
import { SendTemplateRequestSchema } from '../request-dtos/send-template-request.dto.js';
import type { SendTemplateRequestDto } from '../request-dtos/send-template-request.dto.js';
import { AssignConversationRequestSchema } from '../request-dtos/assign-conversation-request.dto.js';
import type { AssignConversationRequestDto } from '../request-dtos/assign-conversation-request.dto.js';
import { ConversationQueryParamsSchema } from '../request-dtos/conversation-query-params.dto.js';
import type { ConversationQueryParamsDto } from '../request-dtos/conversation-query-params.dto.js';
import { AddNoteRequestSchema } from '../request-dtos/add-note-request.dto.js';
import type { AddNoteRequestDto } from '../request-dtos/add-note-request.dto.js';
import { AssignLabelRequestSchema } from '../request-dtos/assign-label-request.dto.js';
import type { AssignLabelRequestDto } from '../request-dtos/assign-label-request.dto.js';
import { DemoAiReplyUseCase } from '../../application/use-cases/conversation/demo-ai-reply.use-case.js';
import { DomainError } from '../../domain/errors/domain-errors.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';
import type { AgentRepository } from '../../domain/repositories/agent.repository.js';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';
import type { ConversationLabelRepository } from '../../domain/repositories/conversation-label.repository.js';
import type { LabelRepository } from '../../domain/repositories/label.repository.js';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository.js';

@ApiTags('Conversations')
@ApiBearerAuth('JWT')
@Controller('conversations')
export class ConversationController {
  constructor(
    @Inject('ListConversationsUseCase') private readonly listConversations: ListConversationsUseCase,
    @Inject('GetConversationDetailUseCase') private readonly getDetail: GetConversationDetailUseCase,
    @Inject('GetConversationMessagesUseCase') private readonly getMessages: GetConversationMessagesUseCase,
    @Inject('SendMessageUseCase') private readonly sendMessage: SendMessageUseCase,
    @Inject('SendTemplateMessageUseCase') private readonly sendTemplateMessage: SendTemplateMessageUseCase,
    @Inject('AssignConversationUseCase') private readonly assignConversation: AssignConversationUseCase,
    @Inject('GetConversationEventsUseCase') private readonly getConversationEvents: GetConversationEventsUseCase,
    @Inject('AddConversationNoteUseCase') private readonly addNote: AddConversationNoteUseCase,
    @Inject('GetConversationNotesUseCase') private readonly getNotes: GetConversationNotesUseCase,
    @Inject('AssignLabelUseCase') private readonly assignLabel: AssignLabelUseCase,
    @Inject('RemoveLabelUseCase') private readonly removeLabel: RemoveLabelUseCase,
    @Inject('GetConversationLabelsUseCase') private readonly getConversationLabels: GetConversationLabelsUseCase,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
    @Inject('AgentRepository') private readonly agentRepo: AgentRepository,
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
    @Inject('ConversationLabelRepository') private readonly convLabelRepo: ConversationLabelRepository,
    @Inject('LabelRepository') private readonly labelRepo: LabelRepository,
    @Inject('DemoAiReplyUseCase') private readonly demoAiReply: DemoAiReplyUseCase,
    @Inject('ConversationRepository') private readonly conversationRepo: ConversationRepository,
  ) {}

  /** Verify conversation belongs to the agent's tenant. Throws if not found or wrong tenant. */
  private async verifyTenantAccess(conversationId: string, tenantId: string): Promise<void> {
    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.tenantId !== tenantId) throw new ForbiddenException('Access denied');
  }

  @Get()
  @ApiOperation({ summary: 'List conversations', description: 'List conversations with filtering and pagination. Agents see their own + unassigned; admins see all.' })
  @ApiQuery({ name: 'status', required: false, enum: ['unassigned', 'active'], description: 'Filter by conversation status' })
  @ApiQuery({ name: 'agentId', required: false, description: 'Filter by assigned agent ID' })
  @ApiQuery({ name: 'phoneNumberId', required: false, description: 'Filter by phone number ID' })
  @ApiQuery({ name: 'view', required: false, enum: ['inbox', 'campaign', 'all'], description: 'inbox (default) hides unanswered campaign conversations; campaign shows only those; all shows everything' })
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

    // Batch-lookup labels for all conversations
    const conversationIds = result.data.map((c) => c.id);
    const allConvLabels = await this.convLabelRepo.findByConversationIds(conversationIds);
    const labelIds = [...new Set(allConvLabels.map((cl) => cl.labelId))];
    const labels = labelIds.length > 0 ? await this.labelRepo.findByIds(labelIds) : [];
    const labelMap = new Map(labels.map((l) => [l.id, l]));
    const convLabelMap = new Map<string, { id: string; name: string; color: string }[]>();
    for (const cl of allConvLabels) {
      const label = labelMap.get(cl.labelId);
      if (!label) continue;
      const arr = convLabelMap.get(cl.conversationId) ?? [];
      arr.push({ id: label.id, name: label.name, color: label.color });
      convLabelMap.set(cl.conversationId, arr);
    }

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
          labels: convLabelMap.get(conv.id) ?? [],
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
  async detail(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    await this.verifyTenantAccess(id, agent.tenantId);
    const result = await this.getDetail.execute(id);
    if (!result.ok) throw new NotFoundException(result.error.message);
    const contact = await this.contactRepo.findById(result.value.contactId);
    const assignedAgent = result.value.agentId ? await this.agentRepo.findById(result.value.agentId) : null;
    const phone = await this.phoneRepo.findById(result.value.phoneNumberId);
    const convLabels = await this.convLabelRepo.findByConversationId(id);
    const detailLabelIds = [...new Set(convLabels.map((cl) => cl.labelId))];
    const detailLabels = detailLabelIds.length > 0 ? await this.labelRepo.findByIds(detailLabelIds) : [];
    const detailLabelMap = new Map(detailLabels.map((l) => [l.id, l]));

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
            customFields: contact.customFields,
          }
        : null,
      agentName: assignedAgent?.name ?? null,
      phoneLabel: phone?.label ?? null,
      phoneDisplay: phone?.displayPhone ?? null,
      labels: convLabels
        .map((cl) => {
          const l = detailLabelMap.get(cl.labelId);
          return l ? { id: l.id, name: l.name, color: l.color } : null;
        })
        .filter(Boolean),
    };
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Get conversation events', description: 'Get the event timeline for a conversation (assignments, status changes, etc.)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'List of conversation events' })
  async events(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    await this.verifyTenantAccess(id, agent.tenantId);
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
    @CurrentAgent() agent: RequestAgent,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.verifyTenantAccess(id, agent.tenantId);
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
    await this.verifyTenantAccess(id, agent.tenantId);
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

  @Post(':id/send-template')
  @ApiOperation({ summary: 'Send template message', description: 'Send an approved template in a conversation (works outside the 24h window)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['templateId'],
      properties: {
        templateId: { type: 'string' },
        variables: { type: 'object', additionalProperties: { type: 'string' }, description: 'Canonical keys: body.1, header.link, button.0.1' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Template sent' })
  @ApiResponse({ status: 400, description: 'Missing variables or template not approved' })
  @ApiResponse({ status: 403, description: 'Agent not assigned and not admin' })
  @ApiResponse({ status: 404, description: 'Conversation or template not found' })
  async sendTemplate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendTemplateRequestSchema)) body: SendTemplateRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    await this.verifyTenantAccess(id, agent.tenantId);
    const result = await this.sendTemplateMessage.execute({
      conversationId: id,
      agentId: agent._id,
      agentRole: agent.role,
      templateId: body.templateId,
      variables: body.variables,
    });
    if (!result.ok) {
      const error = result.error as DomainError;
      if (error.code === 'AGENT_NOT_ASSIGNED') throw new ForbiddenException(error.message);
      if (error.code === 'CONVERSATION_NOT_FOUND' || error.code === 'TEMPLATE_NOT_FOUND') throw new NotFoundException(error.message);
      throw new BadRequestException(error.message);
    }
    return result.value;
  }

  @Post(':id/demo-ai-reply')
  @ApiOperation({ summary: 'Trigger demo AI reply', description: 'Triggers a mock AI reply for demo conversations assigned to AI agents' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Demo AI reply triggered' })
  async demoAiReplyEndpoint(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    await this.verifyTenantAccess(id, agent.tenantId);
    // Fire and forget — the use case handles validation and delay internally
    this.demoAiReply.execute(id).catch(() => {});
    return { ok: true };
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Get conversation notes', description: 'Get internal notes for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'List of notes' })
  async notes(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    await this.verifyTenantAccess(id, agent.tenantId);
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

  @Get(':id/labels')
  @ApiOperation({ summary: 'Get conversation labels', description: 'Get labels assigned to a conversation' })
  async conversationLabels(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    await this.verifyTenantAccess(id, agent.tenantId);
    return this.getConversationLabels.execute(id);
  }

  @Post(':id/labels')
  @ApiOperation({ summary: 'Assign label', description: 'Assign a label to a conversation' })
  async assignLabelToConversation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignLabelRequestSchema)) body: AssignLabelRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.assignLabel.execute({
      conversationId: id,
      labelId: body.labelId,
      agentId: agent._id,
      tenantId: agent.tenantId,
    });
    if (!result.ok) {
      if (result.error.code === 'LABEL_ALREADY_ASSIGNED') throw new ConflictException(result.error.message);
      throw new NotFoundException(result.error.message);
    }
    return result.value;
  }

  @Delete(':id/labels/:labelId')
  @ApiOperation({ summary: 'Remove label', description: 'Remove a label from a conversation' })
  async removeLabelFromConversation(
    @Param('id') id: string,
    @Param('labelId') labelId: string,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.removeLabel.execute({
      conversationId: id,
      labelId,
      agentId: agent._id,
      tenantId: agent.tenantId,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return { removed: true };
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

}
