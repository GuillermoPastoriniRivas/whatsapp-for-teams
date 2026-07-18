import { Agent } from '../../../domain/entities/agent.entity.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AgentPhoneAccessRepository } from '../../../domain/repositories/agent-phone-access.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { InboundMessageInput } from '../../dtos/webhook/inbound-message-input.dto.js';
import { AutoAssignConversationUseCase } from '../conversation/auto-assign-conversation.use-case.js';
import { AttributeCampaignReplyUseCase } from '../campaign/attribute-campaign-reply.use-case.js';
import { SendPushToAgentUseCase } from '../notification/send-push-to-agent.use-case.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { ConversationOrigin } from '../../../domain/enums/conversation-origin.enum.js';

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
    private readonly attributeCampaignReply: AttributeCampaignReplyUseCase,
    private readonly sendPushToAgent: SendPushToAgentUseCase,
    private readonly accessRepo: AgentPhoneAccessRepository,
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
      origin: ConversationOrigin.INBOUND,
      hasReplied: true,
      repliedAt: null,
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

    // 5. Update conversation timestamps.
    // A reply to a campaign conversation promotes it into the regular inbox.
    const promotedFromCampaign = !conversation.hasReplied;
    await this.conversationRepo.update(conversation.id, {
      lastMessageAt: now,
      lastInboundAt: now,
      ...(promotedFromCampaign ? { hasReplied: true, repliedAt: now } : {}),
    } as any);

    // 5b. Attribute this reply to any open campaign sends for the contact
    await this.attributeCampaignReply.execute(contact.id, now);

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
    let humanAgent: Agent | null = null;
    if (assignedAgent) {
      if (assignedAgent.type === AgentType.AI) {
        aiAgent = assignedAgent;
      } else {
        humanAgent = assignedAgent;
      }
    } else if (!needsAssignment && conversation.agentId) {
      const currentAgent = await this.agentRepo.findById(conversation.agentId);
      if (currentAgent && currentAgent.type === AgentType.AI) {
        aiAgent = currentAgent;
      } else {
        humanAgent = currentAgent;
      }
    }

    if (aiAgent) {
      await this.enqueueAiResponse(aiAgent, conversation.id, phone, contact.waId);
    }

    // 9. Web push (fire-and-forget; the SW suppresses it when the app is
    // focused). Assigned human → only them; AI-assigned or unassigned →
    // every human agent with access to this phone number.
    const payload = {
      title: contact.name || contact.phone,
      body: this.messagePreview(input.body, input.messageType),
      url: `/conversations/${conversation.id}`,
      tag: `conv-${conversation.id}`,
    };
    if (humanAgent) {
      void this.sendPushToAgent.execute(humanAgent.id, payload);
    } else {
      void this.pushToHumansWithPhoneAccess(phone.id, payload);
    }
  }

  private async pushToHumansWithPhoneAccess(
    phoneId: string,
    payload: { title: string; body: string; url: string; tag: string },
  ): Promise<void> {
    try {
      const accessList = await this.accessRepo.findByPhoneNumberId(phoneId);
      const agents = await Promise.all(accessList.map((a) => this.agentRepo.findById(a.agentId)));
      const humanIds = new Set(
        agents
          .filter((a): a is Agent => !!a && a.type === AgentType.HUMAN)
          .map((a) => a.id),
      );
      await Promise.allSettled(
        [...humanIds].map((id) => this.sendPushToAgent.execute(id, payload)),
      );
    } catch {
      // el push nunca debe romper el flujo del webhook
    }
  }

  private messagePreview(body: string | null | undefined, messageType: string | undefined): string {
    if (body) return body.length > 120 ? `${body.slice(0, 117)}...` : body;
    switch (messageType) {
      case MessageType.IMAGE: return '📷 Imagen';
      case MessageType.VIDEO: return '🎬 Video';
      case MessageType.AUDIO: return '🎵 Audio';
      case MessageType.DOCUMENT: return '📄 Documento';
      default: return 'Nuevo mensaje';
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
