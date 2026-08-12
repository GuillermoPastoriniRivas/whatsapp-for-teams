import {
  Controller, Get, Post, Body, Param, Query,
  Inject, UseGuards, HttpException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator.js';
import { ApiKeyGuard } from '../guards/api-key.guard.js';
import { ApiPrincipal } from '../decorators/api-principal.decorator.js';
import { RequireScopes } from '../decorators/require-scopes.decorator.js';
import type { ApiKeyPrincipal } from '../decorators/api-principal.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  PublicSendMessageRequestSchema, PublicConversationMessageRequestSchema, PublicCreateContactRequestSchema,
} from '../request-dtos/public-api-requests.dto.js';
import type {
  PublicSendMessageRequestDto, PublicConversationMessageRequestDto, PublicCreateContactRequestDto,
} from '../request-dtos/public-api-requests.dto.js';
import { SendApiMessageUseCase } from '../../application/use-cases/developer/send-api-message.use-case.js';
import { CreateContactUseCase } from '../../application/use-cases/contact/create-contact.use-case.js';
import { resolvePlanFeatures } from '../../application/use-cases/developer/plan-features.util.js';
import { serializeMessage, serializeConversation, serializeContact } from '../../application/use-cases/developer/developer-payloads.util.js';
import { DomainError } from '../../domain/errors/domain-errors.js';
import { SUBSCRIBABLE_DEVELOPER_EVENTS } from '../../domain/enums/developer-event-type.enum.js';
import { TemplateStatus } from '../../domain/enums/template-status.enum.js';
import type { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import type { SubscriptionRepository } from '../../domain/repositories/subscription.repository.js';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository.js';
import type { MessageRepository } from '../../domain/repositories/message.repository.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';
import type { MessageTemplateRepository } from '../../domain/repositories/message-template.repository.js';
import type { ConversationStatus } from '../../domain/enums/conversation-status.enum.js';

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  CONVERSATION_NOT_FOUND: 404,
  TEMPLATE_NOT_FOUND: 404,
  PHONE_NUMBER_NOT_FOUND: 404,
  CONTACT_NOT_FOUND: 404,
  CONVERSATION_WINDOW_EXPIRED: 422,
  MISSING_TEMPLATE_VARIABLES: 422,
  TEMPLATE_NOT_APPROVED: 422,
  TEMPLATE_PHONE_MISMATCH: 422,
  INVALID_RECIPIENT: 422,
  INVALID_PHONE: 422,
  AUTH_TEMPLATE_REQUIRES_PHONE: 422,
  MARKETING_OPT_OUT: 422,
  MISSING_MESSAGE_CONTENT: 422,
  PHONE_NUMBER_AMBIGUOUS: 422,
  PHONE_NUMBER_INACTIVE: 422,
  FEATURE_NOT_IN_PLAN: 403,
};

/**
 * API pública para desarrolladores (autenticación por API key).
 * Prefijo global 'api' ⇒ rutas /api/v1/*.
 */
@ApiTags('Public API (v1)')
@ApiSecurity('ApiKey')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class PublicApiController {
  constructor(
    @Inject('TenantRepository') private readonly tenantRepo: TenantRepository,
    @Inject('SubscriptionRepository') private readonly subscriptionRepo: SubscriptionRepository,
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
    @Inject('ConversationRepository') private readonly conversationRepo: ConversationRepository,
    @Inject('MessageRepository') private readonly messageRepo: MessageRepository,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
    @Inject('MessageTemplateRepository') private readonly templateRepo: MessageTemplateRepository,
    @Inject('SendApiMessageUseCase') private readonly sendApiMessage: SendApiMessageUseCase,
    @Inject('CreateContactUseCase') private readonly createContact: CreateContactUseCase,
  ) {}

  private fail(error: DomainError): never {
    throw new HttpException(
      { code: error.code, message: error.message },
      DOMAIN_ERROR_STATUS[error.code] ?? 400,
    );
  }

  private parsePage(page?: string, limit?: string, defaultLimit = 20) {
    return {
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit ?? String(defaultLimit), 10) || defaultLimit)),
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Authenticated account', description: 'Returns the tenant and API key behind the provided credentials. Useful as a connectivity check.' })
  async me(@ApiPrincipal() principal: ApiKeyPrincipal) {
    const [tenant, { plan }] = await Promise.all([
      this.tenantRepo.findById(principal.tenantId),
      resolvePlanFeatures(this.subscriptionRepo, principal.tenantId),
    ]);
    return {
      tenant: { id: principal.tenantId, name: tenant?.name ?? null },
      apiKey: { id: principal.apiKeyId, name: principal.keyName },
      plan,
    };
  }

  @Get('events')
  @ApiOperation({ summary: 'Webhook event catalog', description: 'Event types your webhook endpoints can subscribe to.' })
  events() {
    return { data: SUBSCRIBABLE_DEVELOPER_EVENTS };
  }

  @Get('phone-numbers')
  @RequireScopes('messages:read')
  @ApiOperation({ summary: 'List WhatsApp numbers', description: 'Active WhatsApp numbers of the account. Use their `id` as `phoneNumberId` when sending messages.' })
  async phoneNumbers(@ApiPrincipal() principal: ApiKeyPrincipal) {
    const phones = await this.phoneRepo.findByTenantId(principal.tenantId);
    return {
      data: phones.map((p) => ({
        id: p.id,
        label: p.label,
        displayPhone: p.displayPhone,
        status: p.status,
      })),
    };
  }

  @Get('templates')
  @RequireScopes('messages:read')
  @ApiOperation({ summary: 'List approved templates', description: 'Approved WhatsApp templates, usable to start conversations via POST /v1/messages.' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async templates(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const paging = this.parsePage(page, limit, 50);
    const result = await this.templateRepo.findByFilters({
      tenantId: principal.tenantId,
      status: TemplateStatus.APPROVED,
      ...paging,
    });
    return {
      data: result.data.map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        phoneNumberId: t.phoneNumberId,
        components: t.components,
      })),
      meta: result.meta,
    };
  }

  @Post('messages')
  @RequireScopes('messages:write')
  @ApiOperation({
    summary: 'Send a message to a phone number',
    description:
      'Sends a WhatsApp message to any number, creating the contact and conversation if needed. ' +
      'Free-form content (`body`, `location`, `contacts`, `interactive`, `reaction`) requires the 24h customer service window; ' +
      '`templateId` (an approved template) works anytime.',
  })
  async sendMessage(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Body(new ZodValidationPipe(PublicSendMessageRequestSchema)) body: PublicSendMessageRequestDto,
  ) {
    const result = await this.sendApiMessage.execute({
      tenantId: principal.tenantId,
      to: body.to,
      phoneNumberId: body.phoneNumberId,
      contactName: body.contactName,
      body: body.body,
      templateId: body.templateId,
      variables: body.variables,
      location: body.location,
      contacts: body.contacts,
      interactive: body.interactive,
      reaction: body.reaction,
      replyToWaMessageId: body.replyToWaMessageId,
      marketingLite: body.marketingLite,
    });
    if (!result.ok) this.fail(result.error as DomainError);
    return result.value;
  }

  @Get('conversations')
  @RequireScopes('messages:read')
  @ApiOperation({ summary: 'List conversations' })
  @ApiQuery({ name: 'status', required: false, enum: ['unassigned', 'active'] })
  @ApiQuery({ name: 'phoneNumberId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async conversations(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Query('status') status?: string,
    @Query('phoneNumberId') phoneNumberId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const paging = this.parsePage(page, limit);
    const result = await this.conversationRepo.findByFilters({
      tenantId: principal.tenantId,
      status: status as ConversationStatus | undefined,
      phoneNumberId: phoneNumberId || undefined,
      view: 'all',
      ...paging,
    });
    return { data: result.data.map(serializeConversation), meta: result.meta };
  }

  @Get('conversations/:id')
  @RequireScopes('messages:read')
  @ApiOperation({ summary: 'Get a conversation' })
  @ApiParam({ name: 'id' })
  async conversation(@Param('id') id: string, @ApiPrincipal() principal: ApiKeyPrincipal) {
    const conversation = await this.conversationRepo.findById(id);
    if (!conversation || conversation.tenantId !== principal.tenantId) {
      throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' });
    }
    const contact = await this.contactRepo.findById(conversation.contactId);
    return {
      ...serializeConversation(conversation),
      contact: contact ? serializeContact(contact) : null,
    };
  }

  @Get('conversations/:id/messages')
  @RequireScopes('messages:read')
  @ApiOperation({ summary: 'List messages of a conversation' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async conversationMessages(
    @Param('id') id: string,
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const conversation = await this.conversationRepo.findById(id);
    if (!conversation || conversation.tenantId !== principal.tenantId) {
      throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' });
    }
    const paging = this.parsePage(page, limit, 50);
    const result = await this.messageRepo.findByConversationId(id, paging.page, paging.limit);
    return { data: result.data.map(serializeMessage), meta: result.meta };
  }

  @Post('conversations/:id/messages')
  @RequireScopes('messages:write')
  @ApiOperation({
    summary: 'Reply in a conversation',
    description: 'Sends a free-form text message in an existing conversation (24h window rules apply).',
  })
  @ApiParam({ name: 'id' })
  async replyInConversation(
    @Param('id') id: string,
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Body(new ZodValidationPipe(PublicConversationMessageRequestSchema)) body: PublicConversationMessageRequestDto,
  ) {
    const conversation = await this.conversationRepo.findById(id);
    if (!conversation || conversation.tenantId !== principal.tenantId) {
      throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' });
    }
    const contact = await this.contactRepo.findById(conversation.contactId);
    if (!contact) {
      throw new NotFoundException({ code: 'CONTACT_NOT_FOUND', message: 'Contact not found.' });
    }
    // Delegar en el use case de envío: contacto+número resuelven a esta misma conversación
    const result = await this.sendApiMessage.execute({
      tenantId: principal.tenantId,
      contactId: contact.id,
      phoneNumberId: conversation.phoneNumberId,
      body: body.body,
    });
    if (!result.ok) this.fail(result.error as DomainError);
    return result.value;
  }

  @Get('contacts')
  @RequireScopes('messages:read')
  @ApiOperation({ summary: 'List contacts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async contacts(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const paging = this.parsePage(page, limit, 50);
    const result = await this.contactRepo.findByTenantId(principal.tenantId, {
      search: search || undefined,
      ...paging,
    });
    return { data: result.data.map(serializeContact), meta: result.meta };
  }

  @Post('contacts')
  @RequireScopes('messages:write')
  @ApiOperation({ summary: 'Create a contact', description: 'Find-or-create by phone number; an existing contact is returned untouched.' })
  async createContactEndpoint(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Body(new ZodValidationPipe(PublicCreateContactRequestSchema)) body: PublicCreateContactRequestDto,
  ) {
    const result = await this.createContact.execute({
      tenantId: principal.tenantId,
      phone: body.phone,
      name: body.name,
    });
    if (!result.ok) this.fail(result.error as DomainError);
    return serializeContact(result.value);
  }
}
