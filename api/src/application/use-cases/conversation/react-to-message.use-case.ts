import { Message } from '../../../domain/entities/message.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  ConversationNotFoundError,
  AgentNotAssignedError,
  ConversationWindowExpiredError,
} from '../../../domain/errors/domain-errors.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { recipientIdentityOf } from '../../../domain/value-objects/recipient-identity.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface ReactToMessageInput {
  conversationId: string;
  /** Id **nuestro** del mensaje al que se reacciona. */
  messageId: string;
  /** Emoji. Vacío quita la reacción, que es como lo modela Meta. */
  emoji: string;
  agentId: string;
}

/**
 * Reacciona con un emoji a un mensaje de la conversación.
 *
 * La reacción es un mensaje como cualquier otro para Meta: consume ventana de
 * 24 h y devuelve su propio wamid. Se persiste como `MessageType.REACTION` con
 * `contextWaMessageId` apuntando al mensaje reaccionado.
 */
export class ReactToMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: ReactToMessageInput): Promise<Result<Message, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());
    if (conversation.agentId !== input.agentId) return err(new AgentNotAssignedError());

    if (Date.now() - conversation.lastInboundAt.getTime() >= TWENTY_FOUR_HOURS_MS) {
      return err(new ConversationWindowExpiredError());
    }

    const target = await this.messageRepo.findById(input.messageId);
    if (!target || target.conversationId !== conversation.id) {
      return err(new DomainError('QUOTED_MESSAGE_NOT_FOUND', 'The message is not part of this conversation.'));
    }

    // Meta rechaza con 131009 una reacción a un mensaje propio: sólo se puede
    // reaccionar a lo que mandó el cliente. Verificado contra la API real; se
    // corta acá para no gastar el viaje ni mostrar un error opaco.
    if (target.direction !== MessageDirection.INBOUND) {
      return err(
        new DomainError('REACTION_TARGET_NOT_INBOUND', 'WhatsApp only allows reacting to messages sent by the customer.'),
      );
    }

    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);
    if (!phone || phone.status !== 'active') {
      return err(new DomainError('PHONE_NUMBER_INACTIVE', 'This phone number is currently inactive.'));
    }

    const contact = await this.contactRepo.findById(conversation.contactId);
    if (!contact) return err(new DomainError('CONTACT_NOT_FOUND', 'Contact not found.'));

    const agent = await this.agentRepo.findById(input.agentId);

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      ...recipientIdentityOf(contact),
      type: MessageType.REACTION,
      reaction: { waMessageId: target.waMessageId, emoji: input.emoji },
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.REACTION,
      body: input.emoji || null,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: input.agentId,
      senderAgentName: agent?.name ?? null,
      contextWaMessageId: target.waMessageId,
    });

    this.gateway.emitToConversation(conversation.id, 'message.new', message);

    return ok(message);
  }
}
