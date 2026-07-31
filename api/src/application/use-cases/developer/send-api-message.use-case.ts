import { Message } from '../../../domain/entities/message.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  ConversationWindowExpiredError,
  RecipientNotReachableError,
} from '../../../domain/errors/domain-errors.js';
import { normalizePhone } from '../contact/normalize-phone.js';
import { listTemplatePlaceholders, buildTemplatePayload, TemplatePlaceholder } from '../campaign/helpers/template-variable.resolver.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationOrigin } from '../../../domain/enums/conversation-origin.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { serializeMessage, serializeConversation, serializeContact } from './developer-payloads.util.js';
import { CancelActiveFlowExecutionUseCase } from '../flow/cancel-active-flow-execution.use-case.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const API_SENDER_NAME = 'API';

export interface SendApiMessageInput {
  tenantId: string;
  /** Número destino en cualquier formato; se normaliza a wa_id */
  to: string;
  /** Opcional si el tenant tiene un solo número activo */
  phoneNumberId?: string;
  /** Nombre para el contacto si no existe todavía */
  contactName?: string;
  body?: string;
  templateId?: string;
  variables?: Record<string, string>;
}

export interface SendApiMessageOutput {
  message: ReturnType<typeof serializeMessage>;
  conversationId: string;
  contactId: string;
  conversationCreated: boolean;
}

function placeholderKey(p: TemplatePlaceholder): string {
  return p.component === 'button'
    ? `button.${p.index}.${p.position}`
    : `${p.component}.${p.position}`;
}

/**
 * Envío de mensajes desde la API pública de desarrolladores. Resuelve (o crea)
 * contacto y conversación a partir del número destino y envía texto libre
 * (dentro de la ventana de 24 hs) o una plantilla aprobada (siempre).
 */
export class SendApiMessageUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly contactRepo: ContactRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
    private readonly devEvents: DeveloperEventsPort,
    private readonly cancelActiveFlow: CancelActiveFlowExecutionUseCase,
  ) {}

  async execute(input: SendApiMessageInput): Promise<Result<SendApiMessageOutput, DomainError>> {
    if (!input.body && !input.templateId) {
      return err(new DomainError('MISSING_MESSAGE_CONTENT', 'Provide either `body` (free-form text) or `templateId` (approved template).'));
    }

    const waId = normalizePhone(input.to);
    if (!waId) return err(new RecipientNotReachableError(`'${input.to}' is not a valid phone number.`));

    // Resolver el número emisor del tenant
    const phone = await this.resolvePhone(input.tenantId, input.phoneNumberId);
    if (phone instanceof DomainError) return err(phone);

    // Contacto: nunca pisar el nombre de uno existente
    let contact = await this.contactRepo.findByWaId(input.tenantId, waId);
    if (!contact) {
      contact = await this.contactRepo.upsertByWaId(input.tenantId, waId, {
        name: input.contactName?.trim() || waId,
        phone: waId,
      });
    }

    // Conversación: si no existe se crea con lastInboundAt en época 0 para que
    // la ventana de 24 hs dé vencida (el cliente nunca escribió; WhatsApp solo
    // permite iniciar con plantilla).
    const { conversation, created } = await this.conversationRepo.findOrCreateByContactAndPhone({
      tenantId: input.tenantId,
      phoneNumberId: phone.id,
      contactId: contact.id,
      agentId: null,
      status: ConversationStatus.UNASSIGNED,
      lastMessageAt: new Date(),
      lastInboundAt: new Date(0),
      pendingAiSince: null,
      origin: ConversationOrigin.API,
      hasReplied: false,
      repliedAt: null,
    });

    let message: Message;
    if (input.templateId) {
      const sent = await this.sendTemplate(input, phone, contact.waId, conversation.id);
      if (!sent.ok) return sent;
      message = sent.value;
    } else {
      const elapsed = Date.now() - conversation.lastInboundAt.getTime();
      if (elapsed >= TWENTY_FOUR_HOURS_MS) return err(new ConversationWindowExpiredError());

      const { waMessageId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        to: contact.waId,
        type: MessageType.TEXT,
        body: input.body!,
      });

      message = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.TEXT,
        body: input.body!,
        mediaUrl: null,
        mimeType: null,
        waMessageId,
        waStatus: MessageWaStatus.SENT,
        timestamp: new Date(),
        senderAgentId: null,
        senderAgentName: API_SENDER_NAME,
      });
    }

    await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date() } as any);

    // Un sistema externo que escribe toma la conversación, igual que un agente
    // humano: si un flujo estaba esperando respuesta, se detiene. Sin esto los
    // dos le hablan al cliente y el flujo se come como respuesta a su menú lo
    // que el cliente contestó al mensaje de la API. Va después del envío: un
    // intento fallido no llegó al cliente y no debe matar la automatización.
    await this.cancelActiveFlow.execute(conversation.id, 'api_takeover');

    if (created) {
      const createdEvent = await this.eventRepo.create({
        conversationId: conversation.id,
        tenantId: input.tenantId,
        type: ConversationEventType.CREATED,
        performedBy: null,
        data: { contactName: contact.name, contactPhone: contact.phone, via: 'api' },
      });
      this.gateway.emitToConversation(conversation.id, 'conversation.event', createdEvent);
      this.devEvents.emit(input.tenantId, DeveloperEventType.CONVERSATION_CREATED, {
        conversation: serializeConversation(conversation),
        contact: serializeContact(contact),
      });
    }

    this.gateway.emitToConversation(conversation.id, 'message.new', message);
    this.gateway.emitToTenant(input.tenantId, 'conversation.updated', { conversationId: conversation.id });

    this.devEvents.emit(input.tenantId, DeveloperEventType.MESSAGE_SENT, {
      message: serializeMessage(message),
      conversationId: conversation.id,
      via: 'api',
    });

    return ok({
      message: serializeMessage(message),
      conversationId: conversation.id,
      contactId: contact.id,
      conversationCreated: created,
    });
  }

  private async resolvePhone(tenantId: string, phoneNumberId?: string) {
    if (phoneNumberId) {
      const phone = await this.phoneRepo.findById(phoneNumberId);
      if (!phone || phone.tenantId !== tenantId) {
        return new DomainError('PHONE_NUMBER_NOT_FOUND', 'Phone number not found.');
      }
      if (phone.status !== 'active') {
        return new DomainError('PHONE_NUMBER_INACTIVE', 'This phone number is currently inactive.');
      }
      return phone;
    }

    const phones = (await this.phoneRepo.findByTenantId(tenantId)).filter((p) => p.status === 'active');
    if (phones.length === 0) {
      return new DomainError('PHONE_NUMBER_NOT_FOUND', 'The account has no active WhatsApp numbers.');
    }
    if (phones.length > 1) {
      return new DomainError(
        'PHONE_NUMBER_AMBIGUOUS',
        'The account has multiple WhatsApp numbers; specify `phoneNumberId`. List them with GET /v1/phone-numbers.',
      );
    }
    return phones[0];
  }

  private async sendTemplate(
    input: SendApiMessageInput,
    phone: { id: string; provider: any; providerConfig: any; phoneNumberId: string },
    toWaId: string,
    conversationId: string,
  ): Promise<Result<Message, DomainError>> {
    const template = await this.templateRepo.findById(input.templateId!);
    if (!template || template.tenantId !== input.tenantId) {
      return err(new DomainError('TEMPLATE_NOT_FOUND', 'Template not found.'));
    }
    if (template.status !== TemplateStatus.APPROVED) {
      return err(new DomainError('TEMPLATE_NOT_APPROVED', 'Only approved templates can be sent.'));
    }
    if (template.phoneNumberId !== phone.id) {
      return err(new DomainError('TEMPLATE_PHONE_MISMATCH', 'Template belongs to a different phone number.'));
    }

    const variables = input.variables ?? {};
    const missing = listTemplatePlaceholders(template.components)
      .map(placeholderKey)
      .filter((key) => !variables[key]);
    if (missing.length > 0) {
      return err(new DomainError('MISSING_TEMPLATE_VARIABLES', `Missing template variables: ${missing.join(', ')}`));
    }

    const built = buildTemplatePayload(template.components, variables);

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: toWaId,
      type: MessageType.TEMPLATE,
      body: built.renderedBody,
      template: {
        name: template.name,
        language: template.language,
        components: built.components,
      },
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEMPLATE,
      body: built.renderedBody,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: null,
      senderAgentName: API_SENDER_NAME,
    });

    return ok(message);
  }
}
