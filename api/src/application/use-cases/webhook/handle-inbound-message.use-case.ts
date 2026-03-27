import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { InboundMessageInput } from '../../dtos/webhook/inbound-message-input.dto.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';

export class HandleInboundMessageUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly contactRepo: ContactRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly autoAssign: AutoAssignConversationUseCase,
  ) {}

  async execute(input: InboundMessageInput): Promise<void> {
    // TODO: Implement full webhook handling
    // 1. Look up PhoneNumber by input.phoneNumberId → get tenantId
    // 2. Find or create Contact by { tenantId, waId: input.from }
    //    - Update profilePicUrl and lastSeenAt
    // 3. Find open Conversation for { contactId, phoneNumberId, status != resolved }
    //    - If none → create with status: "unassigned"
    // 4. Upsert Message by { waMessageId }
    // 5. Update conversation.lastMessageAt and conversation.lastInboundAt
    // 6. If conversation.status === "unassigned" → call autoAssign.execute()
    // 7. Emit WebSocket event to relevant agents
  }
}
