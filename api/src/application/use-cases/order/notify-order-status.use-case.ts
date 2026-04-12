import { Logger } from '@nestjs/common';
import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiCompletionPort } from '../../ports/ai-completion.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Order } from '../../../domain/entities/order.entity.js';
import { OrderStatus } from '../../../domain/enums/order-status.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';

export class NotifyOrderStatusUseCase {
  private readonly logger = new Logger(NotifyOrderStatusUseCase.name);

  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly messageRepo: MessageRepository,
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
    private readonly aiCompletion: AiCompletionPort,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(order: Order): Promise<void> {
    if (!this.shouldNotify(order)) return;

    try {
      const conversation = await this.conversationRepo.findById(order.conversationId);
      if (!conversation) {
        this.logger.warn(`Conversation ${order.conversationId} not found for order ${order.id}`);
        return;
      }

      const [contact, phone] = await Promise.all([
        this.contactRepo.findById(order.contactId),
        this.phoneRepo.findById(order.phoneNumberId),
      ]);
      if (!contact || !phone) return;

      // Find an active AI agent config for this tenant
      const config = await this.findActiveConfig(conversation.tenantId, conversation.agentId);
      if (!config) {
        this.logger.warn(`No active AI agent config found for tenant ${conversation.tenantId} — skipping order notification`);
        return;
      }

      const agent = await this.agentRepo.findById(config.agentId);
      if (!agent) return;

      // Build notification prompt
      const systemPrompt = this.buildNotificationPrompt(order, contact.name, config.persona.language, config.persona.tone);

      const llmResult = await this.aiCompletion.complete({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt,
        messages: [],
        maxTokens: 150,
      });

      const messageBody = (llmResult.content ?? '').replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]\s?/g, '').trim();

      // Send via WhatsApp
      const { waMessageId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        to: contact.waId,
        type: MessageType.TEXT,
        body: messageBody,
      });

      // Record message
      const message = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.TEXT,
        body: messageBody,
        mediaUrl: null,
        mimeType: null,
        waMessageId,
        waStatus: MessageWaStatus.SENT,
        timestamp: new Date(),
        senderAgentId: agent.id,
        senderAgentName: agent.name,
      });

      await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date() } as any);

      this.gateway.emitToConversation(conversation.id, 'message.new', message);
      this.gateway.emitToTenant(conversation.tenantId, 'conversation.updated', { conversationId: conversation.id });

      this.logger.log(`Order notification sent for order ${order.id} (${order.status}, ${order.deliveryType})`);
    } catch (error) {
      this.logger.error(`Failed to send order notification for ${order.id}: ${error}`);
    }
  }

  private shouldNotify(order: Order): boolean {
    return (
      (order.deliveryType === 'pickup' && order.status === OrderStatus.READY) ||
      (order.deliveryType === 'delivery' && order.status === OrderStatus.ON_THE_WAY)
    );
  }

  private async findActiveConfig(tenantId: string, conversationAgentId: string | null) {
    // Prefer the agent assigned to the conversation
    if (conversationAgentId) {
      const config = await this.configRepo.findByAgentId(conversationAgentId);
      if (config?.isActive) return config;
    }

    // Fallback: find any active AI agent config for this tenant
    const configs = await this.configRepo.findByTenantId(tenantId);
    return configs.find((c) => c.isActive) ?? null;
  }

  private buildNotificationPrompt(order: Order, customerName: string, language: string, tone: string): string {
    const itemList = order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const total = order.estimatedTotal != null ? `$${order.estimatedTotal}` : '';

    const scenario =
      order.deliveryType === 'pickup'
        ? 'The order is READY FOR PICKUP. The customer needs to come pick it up.'
        : 'The order is ON ITS WAY to the customer. It has left for delivery.';

    return `You are a WhatsApp notification assistant for a business.

Generate a SHORT, friendly notification message (1-2 sentences max, under 30 words) for a customer about their order status update.

## Rules
- Write in ${language || 'the same language the business uses'}.
- Tone: ${tone || 'friendly and professional'}.
- Plain text only. No markdown, no bold, no headers.
- No emojis unless the tone specifically calls for it.
- Do NOT include greetings like "Hola" or the customer's name — go straight to the point.
- Do NOT include order IDs or internal codes.
- Sound natural, like a real person texting on WhatsApp.

## Context
- Customer name: ${customerName}
- Order items: ${itemList}
- ${total ? `Total: ${total}` : ''}
- Delivery type: ${order.deliveryType}
- ${scenario}

Generate ONLY the message text, nothing else.`;
  }
}
