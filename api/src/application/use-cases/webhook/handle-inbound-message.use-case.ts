import { Agent } from '../../../domain/entities/agent.entity.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { InboundMessageInput } from '../../dtos/webhook/inbound-message-input.dto.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';

const AI_RESPONSE_JOB = 'ai.process-response';

export class HandleInboundMessageUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly contactRepo: ContactRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly autoAssign: AutoAssignConversationUseCase,
    private readonly eventRepo: ConversationEventRepository,
    private readonly agentRepo: AgentRepository,
    private readonly jobQueue: JobQueuePort,
    private readonly aiConfigRepo: AiAgentConfigRepository,
    private readonly messagingApi: MessagingApiPort,
  ) {}

  async execute(input: InboundMessageInput): Promise<void> {
    // 1. Look up PhoneNumber → get tenantId
    const phone = await this.phoneRepo.findByPhoneNumberId(input.phoneNumberId);
    if (!phone) return;
    if (phone.status !== 'active') return;

    const tenantId = phone.tenantId;

    // 2. Find or create Contact
    const contact = await this.contactRepo.upsertByWaId(tenantId, input.from, {
      name: input.contactName,
      phone: input.from,
      profilePicUrl: input.profilePicUrl ?? null,
    });

    // 3. Atomic find-or-create Conversation (prevents race condition duplicates)
    const now = new Date();
    let needsAssignment = false;

    const { conversation: foundConversation, created } = await this.conversationRepo.findOrCreateByContactAndPhone({
      tenantId,
      phoneNumberId: phone.id,
      contactId: contact.id,
      agentId: null,
      status: ConversationStatus.UNASSIGNED,
      lastMessageAt: now,
      lastInboundAt: now,
      pendingAiSince: null,
    });
    let conversation = foundConversation;

    if (created) {
      const createdEvent = await this.eventRepo.create({
        conversationId: conversation.id,
        tenantId,
        type: ConversationEventType.CREATED,
        performedBy: null,
        data: { contactName: contact.name, contactPhone: contact.phone },
      });
      this.gateway.emitToConversation(conversation.id, 'conversation.event', createdEvent);

      needsAssignment = true;
    } else if (conversation.status === ConversationStatus.RESOLVED) {
      const previouslyResolvedAt = conversation.resolvedAt;

      await this.conversationRepo.update(conversation.id, {
        status: ConversationStatus.UNASSIGNED,
        agentId: null,
        resolvedAt: null,
        closedBy: null,
      } as any);
      conversation = (await this.conversationRepo.findById(conversation.id))!;

      const reopenedEvent = await this.eventRepo.create({
        conversationId: conversation.id,
        tenantId,
        type: ConversationEventType.REOPENED,
        performedBy: null,
        data: { previouslyResolvedAt },
      });
      this.gateway.emitToConversation(conversation.id, 'conversation.event', reopenedEvent);

      needsAssignment = true;
    }

    // 4. Upsert Message (idempotent by waMessageId)
    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      messageType: (input.messageType as MessageType) ?? MessageType.TEXT,
      body: input.body ?? null,
      mediaUrl: input.mediaUrl ?? null,
      mimeType: input.mimeType ?? null,
      waMessageId: input.waMessageId,
      waStatus: MessageWaStatus.DELIVERED,
      timestamp: input.timestamp,
      senderAgentId: null,
      senderAgentName: null,
    });

    // 5. Update conversation timestamps
    await this.conversationRepo.update(conversation.id, {
      lastMessageAt: now,
      lastInboundAt: now,
    } as any);

    // 6. If needs assignment (new or reopened) → auto-assign
    let assignedAgent: Agent | null = null;
    if (needsAssignment) {
      assignedAgent = await this.autoAssign.execute(conversation.id);
    }

    // 7. Emit WebSocket events
    this.gateway.emitToConversation(conversation.id, 'message.new', message);
    this.gateway.emitToTenant(tenantId, 'conversation.updated', { conversationId: conversation.id });

    // 8. If assigned to AI agent → enqueue AI response job (with debounce if enabled)
    let aiAgent: Agent | null = null;
    if (assignedAgent && assignedAgent.type === AgentType.AI) {
      aiAgent = assignedAgent;
    } else if (!needsAssignment && conversation.agentId) {
      const currentAgent = await this.agentRepo.findById(conversation.agentId);
      if (currentAgent && currentAgent.type === AgentType.AI) {
        aiAgent = currentAgent;
      }
    }

    if (aiAgent) {
      await this.enqueueAiResponse(aiAgent, conversation.id, phone, contact.waId);
    }
  }

  private async enqueueAiResponse(
    agent: Agent,
    conversationId: string,
    phone: { provider: any; providerConfig: any; phoneNumberId: string },
    contactWaId: string,
  ): Promise<void> {
    const config = await this.aiConfigRepo.findByAgentId(agent.id);
    const multiMessage = config?.multiMessage;

    if (!multiMessage?.enabled) {
      // No debounce — enqueue immediately (backward compatible)
      await this.jobQueue.enqueue(AI_RESPONSE_JOB, { conversationId });
      return;
    }

    // Send typing indicator immediately so user sees activity
    this.messagingApi.sendTypingIndicator({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: contactWaId,
    }).catch(() => {});

    // Set pendingAiSince if not already set (first unanswered message)
    const conversation = await this.conversationRepo.findById(conversationId);
    const pendingAiSince = conversation?.pendingAiSince ?? new Date();
    if (!conversation?.pendingAiSince) {
      await this.conversationRepo.update(conversationId, { pendingAiSince } as any);
    }

    // Calculate debounced run time with hard cap
    const debounceTime = Date.now() + multiMessage.debounceWindowMs;
    const hardCap = pendingAiSince.getTime() + multiMessage.debounceMaxWaitMs;
    const runAt = new Date(Math.min(debounceTime, hardCap));

    await this.jobQueue.schedule(AI_RESPONSE_JOB, {
      conversationId,
      scheduledFor: runAt.toISOString(),
    }, runAt);
  }
}
