import { Message } from '../../../domain/entities/message.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  ConversationWindowExpiredError,
  RecipientNotReachableError,
  AuthTemplateRequiresPhoneError,
  MarketingOptOutError,
} from '../../../domain/errors/domain-errors.js';
import { TemplateCategory } from '../../../domain/enums/template-category.enum.js';
import { normalizePhone } from '../contact/normalize-phone.js';
import { toMessageLocation } from '../../../domain/value-objects/message-location.js';
import type { InteractiveSendPayload, OutboundContactCard } from '../../ports/messaging-api.port.js';
import { Contact } from '../../../domain/entities/contact.entity.js';
import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { billingForConversation } from '../billing/outbound-billing.helper.js';
import { isBsuidOnly, recipientIdentityOf, templateRequiresPhone } from '../../../domain/value-objects/recipient-identity.js';
import { listTemplatePlaceholders, buildTemplatePayload, TemplatePlaceholder } from '../campaign/helpers/template-variable.resolver.js';
import { templateBelongsToPhone } from '../template/helpers/template-scope.js';
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
  /**
   * Número destino en cualquier formato; se normaliza a dígitos. Opcional
   * cuando se pasa `contactId`.
   */
  to?: string;
  /**
   * Contacto ya resuelto. Tiene prioridad sobre `to` y evita pasar la identidad
   * por `normalizePhone`, que le borraría los puntos y las letras a un BSUID.
   */
  contactId?: string;
  /** Opcional si el tenant tiene un solo número activo */
  phoneNumberId?: string;
  /** Nombre para el contacto si no existe todavía */
  contactName?: string;
  body?: string;
  templateId?: string;
  variables?: Record<string, string>;
  /** Ubicación a mandar (`type: location`). */
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  /** Tarjetas de contacto (`type: contacts`). */
  contacts?: OutboundContactCard[];
  /** Botones, lista, botón con link, pedido de ubicación o de dirección. */
  interactive?: InteractiveSendPayload;
  /** Emoji sobre otro mensaje. Vacío lo quita. */
  reaction?: { waMessageId: string; emoji: string };
  /** Responder citando: wamid de un mensaje de la conversación. */
  replyToWaMessageId?: string;
  /** Mandar la plantilla por Marketing Messages Lite en vez del canal normal. */
  marketingLite?: boolean;
  /**
   * Agente que manda, cuando no es la API pública sino una persona desde el
   * panel (envío suelto de plantilla). Sin esto el mensaje queda firmado
   * como "API".
   */
  sender?: { agentId: string };
}

/** Cómo queda firmado el mensaje saliente. */
interface SenderAttribution {
  agentId: string | null;
  name: string;
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
    private readonly agentRepo: AgentRepository,
  ) {}

  async execute(input: SendApiMessageInput): Promise<Result<SendApiMessageOutput, DomainError>> {
    const hasFreeForm =
      !!input.body || !!input.location || !!input.contacts?.length || !!input.interactive || !!input.reaction;
    if (!hasFreeForm && !input.templateId) {
      return err(
        new DomainError(
          'MISSING_MESSAGE_CONTENT',
          'Provide `templateId` (approved template) or free-form content: `body`, `location`, `contacts`, `interactive` or `reaction`.',
        ),
      );
    }

    // Resolver el número emisor del tenant
    const phone = await this.resolvePhone(input.tenantId, input.phoneNumberId);
    if (phone instanceof DomainError) return err(phone);

    let contact: Contact | null;

    if (input.contactId) {
      // Responder en una conversación existente: la identidad ya está resuelta
      // y puede ser solo-BSUID, así que no pasa por la normalización de teléfono.
      contact = await this.contactRepo.findById(input.contactId);
      if (!contact || contact.tenantId !== input.tenantId) {
        return err(new DomainError('CONTACT_NOT_FOUND', 'Contact not found.'));
      }
    } else {
      const waId = normalizePhone(input.to ?? '');
      if (!waId) return err(new RecipientNotReachableError(`'${input.to ?? ''}' is not a valid phone number.`));

      // Contacto: nunca pisar el nombre de uno existente
      contact = await this.contactRepo.findByPhone(input.tenantId, waId);
      if (!contact) {
        contact = await this.contactRepo.create(
          input.tenantId,
          { phone: waId },
          { name: input.contactName?.trim() || waId },
        );
      }
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

    const sender = await this.resolveSender(input.sender);

    let message: Message;
    if (input.templateId) {
      const sent = await this.sendTemplate(input, phone, contact, conversation, sender);
      if (!sent.ok) return sent;
      message = sent.value;
    } else {
      const elapsed = Date.now() - conversation.lastInboundAt.getTime();
      if (elapsed >= TWENTY_FOUR_HOURS_MS) return err(new ConversationWindowExpiredError());

      // El tipo lo define el contenido que vino. El orden importa: `reaction`
      // primero porque es el único que no admite `context`.
      const messageType = input.reaction
        ? MessageType.REACTION
        : input.location
          ? MessageType.LOCATION
          : input.contacts?.length
            ? MessageType.CONTACTS
            : input.interactive
              ? MessageType.INTERACTIVE
              : MessageType.TEXT;

      const { waMessageId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        ...recipientIdentityOf(contact),
        type: messageType,
        body: input.body,
        location: input.location,
        contacts: input.contacts,
        interactive: input.interactive,
        reaction: input.reaction,
        contextWaMessageId: input.replyToWaMessageId,
        billing: billingForConversation(conversation, contact, { senderKind: 'api' }),
      });

      message = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType,
        body: input.reaction?.emoji ?? input.body ?? null,
        mediaUrl: null,
        mimeType: null,
        waMessageId,
        waStatus: MessageWaStatus.SENT,
        timestamp: new Date(),
        senderAgentId: sender.agentId,
        senderAgentName: sender.name,
        senderKind: 'api',
        location: input.location
          ? toMessageLocation({
              latitude: input.location.latitude,
              longitude: input.location.longitude,
              name: input.location.name,
              address: input.location.address,
            })
          : null,
        interactivePayload: (input.interactive as unknown as Record<string, unknown>) ?? null,
        contextWaMessageId: input.reaction?.waMessageId ?? input.replyToWaMessageId ?? null,
      });
    }

    await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date() } as any);

    // Un sistema externo que escribe toma la conversación, igual que un agente
    // humano: si un flujo estaba esperando respuesta, se detiene. Sin esto los
    // dos le hablan al cliente y el flujo se come como respuesta a su menú lo
    // que el cliente contestó al mensaje de la API. Va después del envío: un
    // intento fallido no llegó al cliente y no debe matar la automatización.
    await this.cancelActiveFlow.execute(
      conversation.id,
      input.sender ? 'agent_takeover' : 'api_takeover',
      input.sender?.agentId ?? null,
    );

    if (created) {
      const createdEvent = await this.eventRepo.create({
        conversationId: conversation.id,
        tenantId: input.tenantId,
        type: ConversationEventType.CREATED,
        performedBy: null,
        data: { contactName: contact.name, contactPhone: contact.phone, via: input.sender ? 'agent' : 'api' },
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
      via: input.sender ? 'agent' : 'api',
    });

    return ok({
      message: serializeMessage(message),
      conversationId: conversation.id,
      contactId: contact.id,
      conversationCreated: created,
    });
  }

  /** Firma del mensaje: el agente que lo mandó desde el panel, o "API". */
  private async resolveSender(sender?: { agentId: string }): Promise<SenderAttribution> {
    if (!sender) return { agentId: null, name: API_SENDER_NAME };
    const agent = await this.agentRepo.findById(sender.agentId);
    return { agentId: sender.agentId, name: agent?.name ?? API_SENDER_NAME };
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
    phone: { id: string; provider: any; providerConfig: any; phoneNumberId: string; wabaId?: string | null },
    contact: Contact,
    conversation: Conversation,
    sender: SenderAttribution,
  ): Promise<Result<Message, DomainError>> {
    const template = await this.templateRepo.findById(input.templateId!);
    if (!template || template.tenantId !== input.tenantId) {
      return err(new DomainError('TEMPLATE_NOT_FOUND', 'Template not found.'));
    }
    if (template.status !== TemplateStatus.APPROVED) {
      return err(new DomainError('TEMPLATE_NOT_APPROVED', 'Only approved templates can be sent.'));
    }
    if (!templateBelongsToPhone(template, phone)) {
      return err(new DomainError('TEMPLATE_PHONE_MISMATCH', 'Template belongs to a different WhatsApp account.'));
    }
    // Meta rechaza las plantillas de autenticación dirigidas a un BSUID (131062).
    if (isBsuidOnly(recipientIdentityOf(contact)) && templateRequiresPhone(template.category)) {
      return err(new AuthTemplateRequiresPhoneError());
    }
    // El opt-out de marketing lo declaró el usuario en WhatsApp: sólo bloquea
    // esa categoría, las de utilidad y autenticación siguen pasando.
    if (template.category === TemplateCategory.MARKETING && contact.marketingOptedOut) {
      return err(new MarketingOptOutError());
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
      ...recipientIdentityOf(contact),
      type: MessageType.TEMPLATE,
      body: built.renderedBody,
      template: {
        name: template.name,
        language: template.language,
        components: built.components,
      },
      // MM Lite sólo aplica a marketing; pedirlo en otra categoría lo rechaza
      // Meta, así que se ignora en vez de romper el envío.
      marketingLite: input.marketingLite && template.category === TemplateCategory.MARKETING,
      // La categoría se congela acá: Meta la puede cambiar después (hay un
      // webhook `template_category_update`) y entonces leerla de la plantilla
      // devolvería una tarifa que no es la que se cobró.
      billing: billingForConversation(conversation, contact, {
        senderKind: 'api',
        templateId: template.id,
        templateCategory: template.category,
        marketingLite: input.marketingLite && template.category === TemplateCategory.MARKETING,
      }),
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEMPLATE,
      body: built.renderedBody,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: sender.agentId,
      senderAgentName: sender.name,
      senderKind: 'api',
    });

    return ok(message);
  }
}
