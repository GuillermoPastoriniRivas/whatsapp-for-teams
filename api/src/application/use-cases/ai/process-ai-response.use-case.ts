import { Logger } from '@nestjs/common';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { AiUsageRepository } from '../../../domain/repositories/ai-usage.repository.js';
import { AiCompletionPort } from '../../ports/ai-completion.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { HandoffToHumanUseCase } from './handoff-to-human.use-case.js';
import { HandoffDetectionDomainService } from '../../../domain/services/handoff-detection.domain-service.js';
import { ContactDirectiveHandler } from './handlers/contact-directive.handler.js';
import { HandoffDirectiveHandler } from './handlers/handoff-directive.handler.js';
import { OrderDirectiveHandler } from './handlers/order-directive.handler.js';
import { CreateOrderUseCase } from '../order/create-order.use-case.js';
import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { PhoneNumberPlugin } from '../../../domain/enums/phone-number-plugin.enum.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { buildIntentPrompt } from './prompts/intent-prompt.builder.js';
import { buildResponsePrompt } from './prompts/response-prompt.builder.js';
import type { IntentResult, CognitiveAction, ActionExecutionResult } from '../../../domain/value-objects/cognitive-loop.types.js';
import { OrderFlowState } from '../../../domain/enums/order-flow-state.enum.js';
import { OrderFlowDomainService } from '../../../domain/services/order-flow.domain-service.js';
import { DeliveryCostDomainService } from '../../../domain/services/delivery-cost.domain-service.js';
import type { OrderFlowData, CustomerInput, LastOrderDefaults } from '../../../domain/value-objects/order-flow.types.js';
import { createDefaultOrderFlow } from '../../../domain/value-objects/order-flow.types.js';

export interface ProcessAiResponseInput {
  conversationId: string;
  messageBody: string;
}

export class ProcessAiResponseUseCase {
  private readonly logger = new Logger(ProcessAiResponseUseCase.name);
  private readonly handoffDetection = new HandoffDetectionDomainService();
  private readonly orderFlowService = new OrderFlowDomainService();
  private readonly deliveryCostService = new DeliveryCostDomainService();
  private readonly contactHandler: ContactDirectiveHandler;
  private readonly handoffHandler: HandoffDirectiveHandler;
  private readonly orderHandler: OrderDirectiveHandler;

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
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly orderRepo: OrderRepository,
  ) {
    this.contactHandler = new ContactDirectiveHandler(this.contactRepo, this.eventRepo, this.gateway);
    this.handoffHandler = new HandoffDirectiveHandler(this.handoffUseCase);
    this.orderHandler = new OrderDirectiveHandler(this.createOrderUseCase);
  }

  async execute(input: ProcessAiResponseInput): Promise<void> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation || !conversation.agentId) return;

    const agent = await this.agentRepo.findById(conversation.agentId);
    if (!agent || agent.type !== AgentType.AI) return;

    const config = await this.configRepo.findByAgentId(agent.id);
    if (!config || !config.isActive) return;

    // Check rate limits
    const today = new Date().toISOString().slice(0, 10);
    if (config.rateLimits.maxMessagesPerDay > 0) {
      const usage = await this.usageRepo.getUsage(config.tenantId, agent.id, today);
      if (usage && usage.messageCount >= config.rateLimits.maxMessagesPerDay) {
        this.logger.warn(`AI agent ${agent.id} exceeded daily message limit`);
        await this.handoffUseCase.execute({
          conversationId: input.conversationId,
          aiAgentId: agent.id,
          tenantId: conversation.tenantId,
          reason: 'Daily message limit exceeded',
        });
        return;
      }
    }

    // Pre-check handoff rules (keyword-based, fast path)
    const preCheck = this.handoffDetection.shouldHandoff(input.messageBody, config.handoffRules, 0);
    if (preCheck.trigger) {
      this.logger.log(`AI handoff pre-check triggered: ${preCheck.reason}`);
      await this.handoffUseCase.execute({
        conversationId: input.conversationId,
        aiAgentId: agent.id,
        tenantId: conversation.tenantId,
        reason: preCheck.reason,
      });
      return;
    }

    // ── Load shared context ──────────────────────────────────────────────
    const historyLimit = config.contextConfig.maxHistoryMessages;
    const { data: messages } = await this.messageRepo.findByConversationId(
      input.conversationId,
      1,
      historyLimit,
    );

    const chatHistory = messages.map((m) => ({
      role: (m.direction === MessageDirection.INBOUND ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `[${m.timestamp.toISOString()}] ${m.body ?? ''}`,
    }));

    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);
    if (!phone) return;

    const contact = config.contextConfig.includeContactInfo
      ? await this.contactRepo.findById(conversation.contactId)
      : null;

    const tenantLabels = await this.labelRepo.findByTenantId(conversation.tenantId);

    // Load orders for this conversation (if orders plugin active)
    const ordersPluginActive = phone.plugins?.includes(PhoneNumberPlugin.ORDERS) ?? false;
    const orders = ordersPluginActive
      ? await this.orderRepo.findByConversationId(conversation.id)
      : [];

    // Initialize order flow state (if orders plugin active)
    let orderFlow: OrderFlowData | null = null;
    let lastOrderDefaults: LastOrderDefaults | null = null;
    if (ordersPluginActive) {
      orderFlow = conversation.orderFlow ?? createDefaultOrderFlow();

      // Build defaults from last completed order for recurring customers
      const lastCompletedOrder = orders.find(
        (o) => o.status === 'delivered' || o.status === 'confirmed' || o.status === 'pending',
      );
      if (lastCompletedOrder) {
        lastOrderDefaults = {
          deliveryType: lastCompletedOrder.deliveryType,
          deliveryAddress: lastCompletedOrder.deliveryAddress ?? undefined,
          neighborhood: lastCompletedOrder.neighborhood ?? undefined,
          paymentMethod: lastCompletedOrder.paymentMethod ?? undefined,
          customerName: lastCompletedOrder.customerName ?? undefined,
          deliveryCost: lastCompletedOrder.deliveryCost ?? undefined,
        };
      }
    }

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateCtx = {
      currentDay: days[now.getDay()],
      currentDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    this.logger.log(`Conversation ${input.conversationId}: ${messages.length} messages loaded`);

    // ── STEP 1: Intent Detection ─────────────────────────────────────────
    const intentPrompt = buildIntentPrompt({
      ...dateCtx,
      contact: contact ? {
        name: contact.name,
        phone: contact.phone ?? undefined,
        email: contact.email ?? undefined,
        company: contact.company ?? undefined,
        notes: contact.notes ?? undefined,
        customFields: contact.customFields ?? undefined,
      } : undefined,
      conversationSummary: conversation.summary ?? undefined,
      knowledgeBase: config.knowledgeBase || undefined,
      goals: config.goals || undefined,
      labels: tenantLabels.map((l: any) => l.name),
      phonePlugins: phone.plugins ?? [],
      handoffRules: {
        keywords: config.handoffRules.keywords,
        urgencyKeywords: config.handoffRules.urgencyKeywords,
        onCustomerRequest: config.handoffRules.onCustomerRequest,
      },
      orders: orders.length > 0 ? orders : undefined,
      orderFlow,
      lastOrderDefaults,
    });

    let intentLlmResult: { content: string; tokensUsed: { prompt: number; completion: number; total: number } };
    try {
      intentLlmResult = await this.aiCompletion.complete({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: intentPrompt,
        messages: chatHistory,
      });
    } catch (error: any) {
      this.logger.error(`AI intent step failed for agent ${agent.id}: ${error.message}`, error.stack);
      throw error;
    }

    this.logger.debug(`Step 1 raw output: ${intentLlmResult.content}`);
    const intentResult = this.parseIntentResult(intentLlmResult.content);
    this.logger.log(`[CognitiveLoop] Step 1 - Intent: "${intentResult.intent}", confidence: ${intentResult.confidence}, actions: ${intentResult.actions.length}`);

    // ── Execute Actions ──────────────────────────────────────────────────
    const actionResults: ActionExecutionResult[] = [];
    let pendingHandoff: { reason: string; summary: string | null } | null = null;

    // Sort actions by priority: escalate first
    const sortedActions = this.sortActionsByPriority(intentResult.actions);

    for (const action of sortedActions) {
      // If escalation is pending, skip non-escalate actions
      if (pendingHandoff && action.type !== 'escalate') continue;

      try {
        const result = await this.executeAction(action, {
          conversationId: conversation.id,
          contactId: conversation.contactId,
          phoneNumberId: conversation.phoneNumberId,
          tenantId: conversation.tenantId,
          agentId: agent.id,
          agentName: agent.name,
          phone,
          tenantLabels,
          conversationSummary: conversation.summary ?? null,
          orders,
          orderFlow,
        });

        if (action.type === 'escalate') {
          pendingHandoff = {
            reason: (action.params.reason as string) || 'AI-initiated escalation',
            summary: conversation.summary ?? null,
          };
        }

        actionResults.push({ action, success: true, result });
      } catch (error: any) {
        this.logger.warn(`Action ${action.type} failed: ${error.message}`);
        actionResults.push({ action, success: false, error: error.message });
      }
    }

    const actionSummary = actionResults.map((r) => `${r.action.type}(${r.success ? 'ok' : 'fail'})`).join(', ');
    if (actionResults.length > 0) {
      this.logger.log(`[CognitiveLoop] Actions: ${actionSummary}`);
    }

    // ── Order Flow State Machine ─────────────────────────────────────────
    let orderFlowDirective: string | null = null;

    if (orderFlow) {
      const extractAction = actionResults.find(
        (r) => r.action.type === 'extract_order_data' && r.success,
      );

      if (extractAction) {
        const customerInput = extractAction.action.params as unknown as CustomerInput;

        // Inject delivery cost deterministically if neighborhood is provided but cost is missing
        if (customerInput.neighborhood && customerInput.deliveryCost === undefined) {
          const costResult = this.deliveryCostService.lookup(customerInput.neighborhood);
          if (costResult.found && costResult.cost !== null) {
            customerInput.deliveryCost = costResult.cost;
          }
        }

        const transition = this.orderFlowService.transition(orderFlow, customerInput, lastOrderDefaults ?? undefined);

        orderFlow = transition.newFlow;
        orderFlowDirective = transition.directive;

        // Persist updated order flow
        await this.conversationRepo.update(conversation.id, { orderFlow } as any);

        // If order should be created, do it now
        if (transition.shouldCreateOrder && transition.orderData) {
          this.logger.log(`[OrderFlow] Creating order from state machine: ${JSON.stringify(transition.orderData)}`);
          try {
            const orderResult = await this.orderHandler.handleAction(
              transition.orderData as any,
              conversation.id,
              conversation.contactId,
              conversation.phoneNumberId,
              conversation.tenantId,
            );
            actionResults.push({
              action: { type: 'create_order', params: transition.orderData as any },
              success: true,
              result: orderResult,
            });

            // Reset flow after successful order creation
            orderFlow = createDefaultOrderFlow();
            await this.conversationRepo.update(conversation.id, { orderFlow } as any);
            this.logger.log(`[OrderFlow] Order created, flow reset to idle`);
          } catch (error: any) {
            this.logger.warn(`[OrderFlow] Order creation failed: ${error.message}`);
            actionResults.push({
              action: { type: 'create_order', params: transition.orderData as any },
              success: false,
              error: error.message,
            });
          }
        }
      }
    }

    // ── STEP 2: Response Generation ──────────────────────────────────────
    const responsePrompt = buildResponsePrompt({
      ...dateCtx,
      persona: config.persona,
      adminSystemPrompt: config.systemPrompt || undefined,
      knowledgeBase: config.knowledgeBase || undefined,
      contact: contact ? {
        name: contact.name,
        phone: contact.phone ?? undefined,
        email: contact.email ?? undefined,
        company: contact.company ?? undefined,
        notes: contact.notes ?? undefined,
        customFields: contact.customFields ?? undefined,
      } : undefined,
      conversationSummary: conversation.summary ?? undefined,
      intentResult,
      actionResults,
      pendingHandoff: !!pendingHandoff,
      orderFlowDirective,
      orderFlow,
      orders: orders.length > 0 ? orders : undefined,
    });

    let responseLlmResult: { content: string; tokensUsed: { prompt: number; completion: number; total: number } };
    try {
      responseLlmResult = await this.aiCompletion.complete({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: responsePrompt,
        messages: chatHistory,
      });
    } catch (error: any) {
      this.logger.error(`AI response step failed for agent ${agent.id}: ${error.message}`, error.stack);
      throw error;
    }

    // Record usage (both calls combined)
    const totalTokens = intentLlmResult.tokensUsed.total + responseLlmResult.tokensUsed.total;
    await this.usageRepo.incrementUsage(config.tenantId, agent.id, today, 1, totalTokens);

    // Post-check: is the response low-confidence?
    if (this.handoffDetection.isLowConfidenceResponse(responseLlmResult.content)) {
      const recentOutbound = messages
        .filter((m) => m.direction === MessageDirection.OUTBOUND && m.senderAgentId === agent.id)
        .slice(-config.handoffRules.maxConsecutiveFailures);

      const consecutiveFailures = recentOutbound.filter((m) =>
        this.handoffDetection.isLowConfidenceResponse(m.body ?? ''),
      ).length + 1;

      const postCheck = this.handoffDetection.shouldHandoff('', config.handoffRules, consecutiveFailures);
      if (postCheck.trigger) {
        this.logger.log(`AI handoff post-check triggered: ${postCheck.reason}`);
        await this.handoffUseCase.execute({
          conversationId: input.conversationId,
          aiAgentId: agent.id,
          tenantId: conversation.tenantId,
          reason: postCheck.reason,
          summary: conversation.summary ?? `Last AI response: "${responseLlmResult.content.substring(0, 200)}"`,
        });
        return;
      }
    }

    // Strip any timestamp prefixes the LLM may have echoed
    const responseContent = responseLlmResult.content.replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]\s?/g, '');

    this.logger.log(`[CognitiveLoop] Step 2 - Response: ${responseContent.length} chars`);

    // ── Send & Record ────────────────────────────────────────────────────
    const sendContact = contact ?? await this.contactRepo.findById(conversation.contactId);
    if (!sendContact) return;

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: sendContact.waId,
      type: MessageType.TEXT,
      body: responseContent,
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEXT,
      body: responseContent,
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

    // Execute handoff AFTER message is sent (customer gets the farewell first)
    if (pendingHandoff) {
      await this.handoffHandler.handleAction(
        pendingHandoff.reason,
        conversation.id,
        agent.id,
        conversation.tenantId,
        pendingHandoff.summary,
      );
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private parseIntentResult(raw: string): IntentResult {
    const fallback: IntentResult = {
      intent: 'respond',
      confidence: 0.5,
      actions: [],
      responseHint: 'Respond naturally to the customer',
    };

    try {
      // Try direct parse
      return this.validateIntentResult(JSON.parse(raw));
    } catch {
      // Try extracting from code fence
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        try {
          return this.validateIntentResult(JSON.parse(fenceMatch[1].trim()));
        } catch { /* fall through */ }
      }

      // Try extracting first JSON object
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return this.validateIntentResult(JSON.parse(jsonMatch[0]));
        } catch { /* fall through */ }
      }

      this.logger.warn(`Failed to parse intent JSON, using fallback. Raw: ${raw.substring(0, 200)}`);
      return fallback;
    }
  }

  private validateIntentResult(parsed: any): IntentResult {
    return {
      intent: typeof parsed.intent === 'string' ? parsed.intent : 'respond',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      responseHint: typeof parsed.responseHint === 'string' ? parsed.responseHint : 'Respond naturally',
    };
  }

  private sortActionsByPriority(actions: CognitiveAction[]): CognitiveAction[] {
    const priority: Record<string, number> = {
      escalate: 0,
      extract_order_data: 1,
      create_order: 2,
      update_contact: 3,
      add_label: 4,
      remove_label: 5,
      update_summary: 6,
      complete_goal: 7,
      respond: 8,
    };
    return [...actions].sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99));
  }

  private async executeAction(
    action: CognitiveAction,
    ctx: {
      conversationId: string;
      contactId: string;
      phoneNumberId: string;
      tenantId: string;
      agentId: string;
      agentName: string;
      phone: any;
      tenantLabels: any[];
      conversationSummary: string | null;
      orders: any[];
      orderFlow: OrderFlowData | null;
    },
  ): Promise<string> {
    switch (action.type) {
      case 'update_contact':
        return this.contactHandler.handleAction(
          action.params as { field: string; value: string },
          ctx.contactId,
          ctx.conversationId,
          ctx.tenantId,
          ctx.agentId,
        );

      case 'extract_order_data':
        // Data extraction is handled after all actions execute (state machine block)
        // Just acknowledge it here so it shows as successful in actionResults
        return 'Order data extracted';

      case 'create_order': {
        // Block direct create_order when order flow state machine is active
        if (ctx.orderFlow && ctx.orderFlow.state !== OrderFlowState.IDLE && ctx.orderFlow.state !== OrderFlowState.ORDER_CREATED) {
          this.logger.warn(`[CognitiveLoop] create_order BLOCKED: order flow state machine is active (state: ${ctx.orderFlow.state})`);
          return 'Order creation is managed by the order flow state machine. Use extract_order_data instead.';
        }

        if (!ctx.phone.plugins?.includes(PhoneNumberPlugin.ORDERS)) {
          this.logger.warn(`[CognitiveLoop] create_order SKIPPED: Orders plugin not enabled`);
          return 'Orders plugin not enabled';
        }

        // Deduplication: skip if a similar pending/confirmed order exists recently
        const newItems = (action.params.items as any[]) ?? [];
        const isDuplicate = ctx.orders.some((existing: any) => {
          if (existing.status !== 'pending' && existing.status !== 'confirmed') return false;
          const ageMs = Date.now() - new Date(existing.createdAt).getTime();
          if (ageMs > 30 * 60 * 1000) return false;
          return this.isSameItemSet(existing.items, newItems);
        });

        if (isDuplicate) {
          this.logger.warn(`[CognitiveLoop] create_order SKIPPED: duplicate order detected`);
          return 'Order already exists with the same items (skipped duplicate)';
        }

        this.logger.log(`[CognitiveLoop] create_order: ${JSON.stringify(action.params)}`);
        const orderResult = await this.orderHandler.handleAction(
          action.params as any,
          ctx.conversationId,
          ctx.contactId,
          ctx.phoneNumberId,
          ctx.tenantId,
        );
        this.logger.log(`[CognitiveLoop] create_order DONE: ${orderResult}`);
        return orderResult;
      }

      case 'add_label':
      case 'remove_label': {
        const labelName = action.params.label as string;
        const label = ctx.tenantLabels.find((l) => l.name.toLowerCase() === labelName?.toLowerCase());
        if (!label) return `Label "${labelName}" not found`;

        if (action.type === 'add_label') {
          await this.convLabelRepo.create({
            conversationId: ctx.conversationId,
            tenantId: ctx.tenantId,
            labelId: label.id,
            assignedBy: ctx.agentId,
          });
          await this.eventRepo.create({
            conversationId: ctx.conversationId,
            tenantId: ctx.tenantId,
            type: ConversationEventType.LABEL_ADDED,
            performedBy: ctx.agentId,
            data: { agentName: ctx.agentName, labelName: label.name, labelColor: label.color },
          });
          this.gateway.emitToConversation(ctx.conversationId, 'label.assigned', {
            conversationId: ctx.conversationId,
            label: { id: label.id, name: label.name, color: label.color },
          });
        } else {
          await this.convLabelRepo.delete(ctx.conversationId, label.id);
          await this.eventRepo.create({
            conversationId: ctx.conversationId,
            tenantId: ctx.tenantId,
            type: ConversationEventType.LABEL_REMOVED,
            performedBy: ctx.agentId,
            data: { agentName: ctx.agentName, labelName: label.name, labelColor: label.color },
          });
          this.gateway.emitToConversation(ctx.conversationId, 'label.removed', {
            conversationId: ctx.conversationId,
            labelId: label.id,
          });
        }
        this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversationId });
        this.logger.log(`AI agent ${ctx.agentId} ${action.type === 'add_label' ? 'added' : 'removed'} label "${label.name}" in conversation ${ctx.conversationId}`);
        return `Label "${label.name}" ${action.type === 'add_label' ? 'added' : 'removed'}`;
      }

      case 'update_summary': {
        const summary = action.params.summary as string;
        if (summary) {
          await this.conversationRepo.update(ctx.conversationId, { summary } as any);
        }
        return 'Conversation summary updated';
      }

      case 'complete_goal': {
        const goal = action.params.goal as string;
        await this.eventRepo.create({
          conversationId: ctx.conversationId,
          tenantId: ctx.tenantId,
          type: ConversationEventType.GOAL_COMPLETED,
          performedBy: ctx.agentId,
          data: { goal, agentName: ctx.agentName },
        });
        this.gateway.emitToConversation(ctx.conversationId, 'conversation.event', {
          type: ConversationEventType.GOAL_COMPLETED,
          data: { goal },
        });
        this.logger.log(`AI agent ${ctx.agentId} completed goal "${goal}" in conversation ${ctx.conversationId}`);
        return `Goal "${goal}" completed`;
      }

      case 'escalate':
        // Don't execute handoff here — just return result. Handoff runs after message is sent.
        return `Handoff scheduled: ${action.params.reason}`;

      case 'respond':
        return 'No action needed';

      default:
        return `Unknown action type: ${action.type}`;
    }
  }

  private isSameItemSet(
    a: Array<{ name: string; quantity: number }>,
    b: Array<{ name: string; quantity: number }>,
  ): boolean {
    if (a.length !== b.length) return false;
    const normalize = (items: typeof a) =>
      items.map((i) => `${i.name.toLowerCase().trim()}:${i.quantity}`).sort().join('|');
    return normalize(a) === normalize(b);
  }
}
