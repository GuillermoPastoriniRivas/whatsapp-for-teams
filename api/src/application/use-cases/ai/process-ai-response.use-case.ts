import { Logger } from '@nestjs/common';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { AiUsageRepository } from '../../../domain/repositories/ai-usage.repository.js';
import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { AiCompletionPort } from '../../ports/ai-completion.port.js';
import type { ChatMessage } from '../../ports/ai-completion.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { HandoffToHumanUseCase } from './handoff-to-human.use-case.js';
import { HandoffDetectionDomainService } from '../../../domain/services/handoff-detection.domain-service.js';
import { ContactDirectiveHandler } from './handlers/contact-directive.handler.js';
import { OrderDirectiveHandler } from './handlers/order-directive.handler.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { PhoneNumberPlugin } from '../../../domain/enums/phone-number-plugin.enum.js';
import { buildSystemPrompt } from './prompts/system-prompt.builder.js';
import { computeBusinessStatus } from './prompts/business-hours.util.js';
import { ToolRegistry } from './tools/tool-registry.js';
import type { ToolContext } from './tools/tool-registry.js';
import { createOrderTools } from './tools/order.tools.js';
import { createContactTools } from './tools/contact.tools.js';
import { createConversationTools } from './tools/conversation.tools.js';

export interface ProcessAiResponseInput {
  conversationId: string;
  messageBody?: string;
  scheduledFor?: string;
}

const MAX_TOOL_ITERATIONS = 10;

export class ProcessAiResponseUseCase {
  private readonly logger = new Logger(ProcessAiResponseUseCase.name);
  private readonly handoffDetection = new HandoffDetectionDomainService();
  private readonly contactHandler: ContactDirectiveHandler;

  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly configRepo: AiAgentConfigRepository,
    private readonly usageRepo: AiUsageRepository,
    private readonly aiCompletion: AiCompletionPort,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
    private readonly handoffUseCase: HandoffToHumanUseCase,
    private readonly labelRepo: LabelRepository,
    private readonly convLabelRepo: ConversationLabelRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly orderRepo: OrderRepository,
    private readonly orderHandler: OrderDirectiveHandler,
    private readonly apiBaseUrl: string,
  ) {
    this.contactHandler = new ContactDirectiveHandler(this.contactRepo, this.eventRepo, this.gateway);
  }

  async execute(input: ProcessAiResponseInput): Promise<void> {
    // ── Load context ────────────────────────────────────────────────────
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation || !conversation.agentId) return;

    const agent = await this.agentRepo.findById(conversation.agentId);
    if (!agent || agent.type !== AgentType.AI) return;

    const config = await this.configRepo.findByAgentId(agent.id);
    if (!config || !config.isActive) return;

    // Debounce idempotency check
    if (config.multiMessage?.enabled && !conversation.pendingAiSince) {
      this.logger.debug(`Skipping AI response for ${input.conversationId} — already processed`);
      return;
    }

    // Debounce freshness check
    if (config.multiMessage?.enabled && input.scheduledFor) {
      const scheduledTime = new Date(input.scheduledFor).getTime();
      const hardCap = conversation.pendingAiSince!.getTime() + config.multiMessage.debounceMaxWaitMs;
      const isHardCap = scheduledTime >= hardCap;

      if (!isHardCap) {
        const lastInbound = conversation.lastInboundAt.getTime();
        const debounceDeadline = lastInbound + config.multiMessage.debounceWindowMs;
        if (debounceDeadline > scheduledTime) {
          this.logger.debug(`Skipping AI response for ${input.conversationId} — newer messages arrived`);
          return;
        }
      }
    }

    // Rate limit check
    const today = new Date().toISOString().slice(0, 10);
    if (config.rateLimits.maxMessagesPerDay > 0) {
      const usage = await this.usageRepo.getUsage(config.tenantId, agent.id, today);
      if (usage && usage.messageCount >= config.rateLimits.maxMessagesPerDay) {
        this.logger.warn(`AI agent ${agent.id} exceeded daily message limit`);
        await this.conversationRepo.update(input.conversationId, { pendingAiSince: null } as any);
        await this.handoffUseCase.execute({
          conversationId: input.conversationId,
          aiAgentId: agent.id,
          tenantId: conversation.tenantId,
          reason: 'Daily message limit exceeded',
        });
        return;
      }
    }

    // Load messages and context
    const historyLimit = config.contextConfig.maxHistoryMessages;
    const { data: messages } = await this.messageRepo.findByConversationId(
      input.conversationId,
      1,
      historyLimit,
    );

    // Pre-check handoff keywords
    const recentInboundText = messages
      .filter((m) => m.direction === MessageDirection.INBOUND)
      .slice(0, 5)
      .map((m) => m.body ?? '')
      .join(' ');
    const preCheck = this.handoffDetection.shouldHandoff(recentInboundText, config.handoffRules, 0);
    if (preCheck.trigger) {
      this.logger.log(`AI handoff pre-check triggered: ${preCheck.reason}`);
      await this.conversationRepo.update(input.conversationId, { pendingAiSince: null } as any);
      await this.handoffUseCase.execute({
        conversationId: input.conversationId,
        aiAgentId: agent.id,
        tenantId: conversation.tenantId,
        reason: preCheck.reason,
      });
      return;
    }

    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);
    if (!phone) return;

    const contact = config.contextConfig.includeContactInfo
      ? await this.contactRepo.findById(conversation.contactId)
      : null;

    const tenantLabels = await this.labelRepo.findByTenantId(conversation.tenantId);
    const enabledPlugins = phone.plugins ?? [];
    const ordersEnabled = enabledPlugins.includes(PhoneNumberPlugin.ORDERS);

    // Load orders context
    const orders = ordersEnabled ? await this.orderRepo.findByConversationId(conversation.id) : [];
    const lastOrderDefaults = this.buildLastOrderDefaults(orders);

    // ── Build system prompt ─────────────────────────────────────────────
    const now = new Date();
    const tz = config.timezone ?? undefined;
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz };
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz };
    const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz });
    const businessStatus = computeBusinessStatus(config.businessHours, config.timezone, now);

    const systemPrompt = buildSystemPrompt({
      currentDay: weekdayFmt.format(now),
      currentDate: now.toLocaleDateString('en-US', dateOpts),
      currentTime: now.toLocaleTimeString('en-US', timeOpts),
      businessStatus: businessStatus ? {
        isOpen: businessStatus.isOpen,
        todayRange: businessStatus.todayRange,
        nextOpen: businessStatus.nextOpen,
      } : null,
      persona: config.persona,
      adminSystemPrompt: config.systemPrompt || undefined,
      knowledgeBase: config.knowledgeBase || undefined,
      goals: config.goals || undefined,
      contact: contact ? {
        name: contact.name,
        phone: contact.phone ?? undefined,
        email: contact.email ?? undefined,
        company: contact.company ?? undefined,
        notes: contact.notes ?? undefined,
        customFields: contact.customFields ?? undefined,
      } : undefined,
      conversationSummary: conversation.summary ?? undefined,
      orders: orders.length > 0 ? orders : undefined,
      lastOrderDefaults,
      handoffRules: {
        keywords: config.handoffRules.keywords,
        urgencyKeywords: config.handoffRules.urgencyKeywords,
        onCustomerRequest: config.handoffRules.onCustomerRequest,
      },
      labels: tenantLabels.map((l: any) => l.name),
      ordersEnabled,
      multiMessage: config.multiMessage?.enabled ? { enabled: true, maxBubbles: config.multiMessage.maxBubbles } : undefined,
    });

    // ── Build tool registry ─────────────────────────────────────────────
    const toolRegistry = new ToolRegistry();

    // Always register contact + conversation tools
    toolRegistry.registerAll(createContactTools(this.contactHandler));
    toolRegistry.registerAll(createConversationTools({
      conversationRepo: this.conversationRepo,
      labelRepo: this.labelRepo,
      convLabelRepo: this.convLabelRepo,
      eventRepo: this.eventRepo,
      gateway: this.gateway,
    }));

    // Register order tools if plugin enabled
    if (ordersEnabled) {
      toolRegistry.registerAll(createOrderTools(this.orderHandler, this.orderRepo, this.apiBaseUrl));
    }

    // ── Build chat history ──────────────────────────────────────────────
    const chatHistory: ChatMessage[] = messages.map((m) => ({
      role: (m.direction === MessageDirection.INBOUND ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `[${m.timestamp.toISOString()}] ${m.body ?? ''}`,
    }));

    // ── Send typing indicator ───────────────────────────────────────────
    const sendContact = contact ?? await this.contactRepo.findById(conversation.contactId);
    if (!sendContact) return;

    const typingParams = {
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: sendContact.waId,
    };
    const typingLoop = this.startTypingLoop(typingParams);

    // ── Tool call loop ──────────────────────────────────────────────────
    let finalContent: string | null = null;
    let pendingHandoffReason: string | null = null;
    let pendingMenuImageUrl: string | null = null;
    let totalTokens = { prompt: 0, completion: 0, total: 0 };
    const loopMessages: ChatMessage[] = [...chatHistory];

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.aiCompletion.complete({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          systemPrompt,
          messages: loopMessages,
          tools: toolRegistry.getDefinitions(),
        });

        totalTokens.prompt += result.tokensUsed.prompt;
        totalTokens.completion += result.tokensUsed.completion;
        totalTokens.total += result.tokensUsed.total;

        this.logger.log(`[ToolLoop] iteration=${i}, finish=${result.finishReason}, toolCalls=${result.toolCalls.length}, content=${result.content?.length ?? 0} chars`);

        if (result.finishReason === 'tool_calls' && result.toolCalls.length > 0) {
          // Append assistant message with tool calls
          loopMessages.push({
            role: 'assistant',
            content: result.content,
            toolCalls: result.toolCalls,
          });

          // Execute each tool call
          const toolCtx: ToolContext = {
            conversationId: conversation.id,
            contactId: conversation.contactId,
            phoneNumberId: conversation.phoneNumberId,
            tenantId: conversation.tenantId,
            agentId: agent.id,
            agentName: agent.name,
          };

          for (const tc of result.toolCalls) {
            this.logger.log(`[ToolLoop] Executing: ${tc.name}(${JSON.stringify(tc.arguments).substring(0, 200)})`);
            const toolResult = await toolRegistry.execute(tc.name, tc.arguments, toolCtx);

            // Check for special signals
            if (toolResult.startsWith('__handoff__:')) {
              pendingHandoffReason = toolResult.replace('__handoff__:', '');
            }
            if (toolResult.startsWith('menu_image_url:')) {
              pendingMenuImageUrl = toolResult.replace('menu_image_url:', '');
            }

            this.logger.log(`[ToolLoop] Result: ${tc.name} → ${toolResult.substring(0, 200)}`);

            loopMessages.push({
              role: 'tool',
              toolCallId: tc.id,
              content: toolResult,
            });
          }

          // Refresh typing for next iteration
          typingLoop.refresh();
          continue;
        }

        // finishReason === 'stop' (or 'length') — we have the final response
        finalContent = result.content;
        break;
      }
    } catch (error: any) {
      typingLoop.stop();
      this.logger.error(`AI tool loop failed for agent ${agent.id}: ${error.message}`, error.stack);
      throw error;
    }

    typingLoop.stop();

    if (!finalContent) {
      this.logger.warn(`AI produced no response after ${MAX_TOOL_ITERATIONS} iterations`);
      finalContent = '';
    }

    // Strip timestamp prefixes the LLM may have echoed
    const responseContent = finalContent.replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]\s?/g, '');

    // Post-check: low-confidence handoff
    if (this.handoffDetection.isLowConfidenceResponse(responseContent)) {
      const recentOutbound = messages
        .filter((m) => m.direction === MessageDirection.OUTBOUND && m.senderAgentId === agent.id)
        .slice(-config.handoffRules.maxConsecutiveFailures);

      const consecutiveFailures = recentOutbound.filter((m) =>
        this.handoffDetection.isLowConfidenceResponse(m.body ?? ''),
      ).length + 1;

      const postCheck = this.handoffDetection.shouldHandoff('', config.handoffRules, consecutiveFailures);
      if (postCheck.trigger) {
        this.logger.log(`AI handoff post-check triggered: ${postCheck.reason}`);
        await this.conversationRepo.update(input.conversationId, { pendingAiSince: null } as any);
        await this.handoffUseCase.execute({
          conversationId: input.conversationId,
          aiAgentId: agent.id,
          tenantId: conversation.tenantId,
          reason: postCheck.reason,
          summary: conversation.summary ?? `Last AI response: "${responseContent.substring(0, 200)}"`,
        });
        return;
      }
    }

    // Parse multi-message bubbles
    const bubbles = config.multiMessage?.enabled
      ? this.parseMultiMessageResponse(responseContent, config.multiMessage.maxBubbles)
      : [responseContent];

    this.logger.log(`Response: ${bubbles.length} bubble(s), ${responseContent.length} chars total`);

    // ── Send & Record ───────────────────────────────────────────────────
    await this.usageRepo.incrementUsage(config.tenantId, agent.id, today, bubbles.length, totalTokens.total);

    for (let i = 0; i < bubbles.length; i++) {
      if (i > 0) {
        this.messagingApi.sendTypingIndicator(typingParams).catch(() => {});
        await new Promise((r) => setTimeout(r, config.multiMessage?.interBubbleDelayMs ?? 1200));
      }

      const body = bubbles[i].substring(0, 4096);

      const { waMessageId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        to: sendContact.waId,
        type: MessageType.TEXT,
        body,
      });

      const message = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.TEXT,
        body,
        mediaUrl: null,
        mimeType: null,
        waMessageId,
        waStatus: MessageWaStatus.SENT,
        timestamp: new Date(),
        senderAgentId: agent.id,
        senderAgentName: agent.name,
      });

      this.gateway.emitToConversation(conversation.id, 'message.new', message);
    }

    // ── Send menu image if queued ───────────────────────────────────────
    if (pendingMenuImageUrl) {
      this.messagingApi.sendTypingIndicator(typingParams).catch(() => {});
      await new Promise((r) => setTimeout(r, config.multiMessage?.interBubbleDelayMs ?? 1200));

      const { waMessageId: imgWaId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        to: sendContact.waId,
        type: MessageType.IMAGE,
        body: '',
        mediaUrl: pendingMenuImageUrl,
      });

      const imgMessage = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.IMAGE,
        body: null,
        mediaUrl: pendingMenuImageUrl,
        mimeType: pendingMenuImageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg',
        waMessageId: imgWaId,
        waStatus: MessageWaStatus.SENT,
        timestamp: new Date(),
        senderAgentId: agent.id,
        senderAgentName: agent.name,
      });

      this.gateway.emitToConversation(conversation.id, 'message.new', imgMessage);
    }

    await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date(), pendingAiSince: null } as any);
    this.gateway.emitToTenant(conversation.tenantId, 'conversation.updated', { conversationId: conversation.id });

    // Execute handoff AFTER message is sent
    if (pendingHandoffReason) {
      await this.handoffUseCase.execute({
        conversationId: input.conversationId,
        aiAgentId: agent.id,
        tenantId: conversation.tenantId,
        reason: pendingHandoffReason,
        summary: conversation.summary ?? undefined,
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private parseMultiMessageResponse(raw: string, maxBubbles: number): string[] {
    const tryParse = (str: string): string[] | null => {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((s: unknown) => typeof s === 'string')) {
          return parsed;
        }
      } catch { /* fall through */ }
      return null;
    };

    let result = tryParse(raw);
    if (result) return result.slice(0, maxBubbles);

    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      result = tryParse(fenceMatch[1].trim());
      if (result) return result.slice(0, maxBubbles);
    }

    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      result = tryParse(arrayMatch[0]);
      if (result) return result.slice(0, maxBubbles);
    }

    this.logger.warn(`Failed to parse multi-message JSON, using single message. Raw: ${raw.substring(0, 200)}`);
    return [raw];
  }

  private startTypingLoop(params: import('../../ports/messaging-api.port.js').TypingIndicatorParams): { stop: () => void; refresh: () => void } {
    const send = () => { this.messagingApi.sendTypingIndicator(params).catch(() => {}); };
    send();
    let timer: ReturnType<typeof setInterval> = setInterval(send, 20_000);
    return {
      stop: () => { clearInterval(timer); },
      refresh: () => { clearInterval(timer); send(); timer = setInterval(send, 20_000); },
    };
  }

  private buildLastOrderDefaults(orders: any[]): {
    deliveryAddress?: string;
    neighborhood?: string;
    paymentMethod?: string;
    customerName?: string;
    deliveryCost?: number;
  } | null {
    const last = orders.find(
      (o) => o.status === 'delivered' || o.status === 'confirmed' || o.status === 'pending',
    );
    if (!last) return null;
    return {
      deliveryAddress: last.deliveryAddress ?? undefined,
      neighborhood: last.neighborhood ?? undefined,
      paymentMethod: last.paymentMethod ?? undefined,
      customerName: last.customerName ?? undefined,
      deliveryCost: last.deliveryCost ?? undefined,
    };
  }
}
