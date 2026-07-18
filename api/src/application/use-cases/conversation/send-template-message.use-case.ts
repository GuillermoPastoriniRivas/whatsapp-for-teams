import { Message } from '../../../domain/entities/message.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ConversationNotFoundError, AgentNotAssignedError } from '../../../domain/errors/domain-errors.js';
import { listTemplatePlaceholders, buildTemplatePayload, TemplatePlaceholder } from '../campaign/helpers/template-variable.resolver.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';

export interface SendTemplateMessageInput {
  conversationId: string;
  agentId: string;
  agentRole: string;
  templateId: string;
  variables: Record<string, string>;
}

function placeholderKey(p: TemplatePlaceholder): string {
  return p.component === 'button'
    ? `button.${p.index}.${p.position}`
    : `${p.component}.${p.position}`;
}

/**
 * Envío de una plantilla aprobada desde el chat. A diferencia de los mensajes
 * libres, NO exige la ventana de 24hs (es justamente la vía para retomar una
 * conversación vencida, según las reglas de WhatsApp).
 */
export class SendTemplateMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly messageRepo: MessageRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: SendTemplateMessageInput): Promise<Result<Message, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    // El asignado puede enviar; un admin también (caso típico: la conversación
    // quedó en manos del bot o sin asignar y venció la ventana)
    if (conversation.agentId !== input.agentId && input.agentRole !== 'admin') {
      return err(new AgentNotAssignedError());
    }

    const template = await this.templateRepo.findById(input.templateId);
    if (!template || template.tenantId !== conversation.tenantId) {
      return err(new DomainError('TEMPLATE_NOT_FOUND', 'Template not found'));
    }
    if (template.status !== TemplateStatus.APPROVED) {
      return err(new DomainError('TEMPLATE_NOT_APPROVED', 'Only approved templates can be sent'));
    }
    if (template.phoneNumberId !== conversation.phoneNumberId) {
      return err(new DomainError('TEMPLATE_PHONE_MISMATCH', 'Template belongs to a different phone number'));
    }

    const missing = listTemplatePlaceholders(template.components)
      .map(placeholderKey)
      .filter((key) => !input.variables[key]);
    if (missing.length > 0) {
      return err(new DomainError('MISSING_TEMPLATE_VARIABLES', `Missing template variables: ${missing.join(', ')}`));
    }

    const contact = await this.contactRepo.findById(conversation.contactId);
    if (!contact) return err(new DomainError('CONTACT_NOT_FOUND', 'Contact not found'));

    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);
    if (!phone || phone.status !== 'active') {
      return err(new DomainError('PHONE_NUMBER_INACTIVE', 'This phone number is currently inactive.'));
    }

    const agent = await this.agentRepo.findById(input.agentId);
    const built = buildTemplatePayload(template.components, input.variables);

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: contact.waId,
      type: MessageType.TEMPLATE,
      body: built.renderedBody,
      template: {
        name: template.name,
        language: template.language,
        components: built.components,
      },
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
      senderAgentId: input.agentId,
      senderAgentName: agent?.name ?? null,
    });

    await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date() } as any);

    this.gateway.emitToConversation(conversation.id, 'message.new', message);

    return ok(message);
  }
}
