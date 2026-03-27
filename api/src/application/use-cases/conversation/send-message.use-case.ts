import { Message } from '../../../domain/entities/message.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { SendMessageInput } from '../../dtos/conversation/send-message-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ConversationNotFoundError, AgentNotAssignedError, ConversationWindowExpiredError } from '../../../domain/errors/domain-errors.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class SendMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: SendMessageInput): Promise<Result<Message, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    if (conversation.agentId !== input.agentId) return err(new AgentNotAssignedError());

    // 24h window check
    const elapsed = Date.now() - conversation.lastInboundAt.getTime();
    if (elapsed >= TWENTY_FOUR_HOURS_MS) return err(new ConversationWindowExpiredError());

    const contact = await this.contactRepo.findById(conversation.contactId);
    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: phone!.provider,
      providerConfig: phone!.providerConfig,
      phoneNumberId: phone!.phoneNumberId,
      to: contact!.waId,
      type: input.messageType ?? MessageType.TEXT,
      body: input.body,
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType: input.messageType ?? MessageType.TEXT,
      body: input.body,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
    });

    await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date() } as any);

    this.gateway.emitToConversation(conversation.id, 'message.new', message);

    return ok(message);
  }
}
