import { Logger } from '@nestjs/common';
import { access } from 'fs/promises';
import { join } from 'path';
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
import { PluginRegistry } from './plugin-registry.js';
import type { PluginContext } from '../../../domain/value-objects/plugin.types.js';
import type { IntentResult, CognitiveAction, ActionExecutionResult } from '../../../domain/value-objects/cognitive-loop.types.js';

export interface ProcessAiResponseInput {
  conversationId: string;
  messageBody?: string;
  scheduledFor?: string;
}

export class ProcessAiResponseUseCase {
  private readonly logger = new Logger(ProcessAiResponseUseCase.name);
  private readonly handoffDetection = new HandoffDetectionDomainService();
  private readonly contactHandler: ContactDirectiveHandler;
  private readonly handoffHandler: HandoffDirectiveHandler;

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
    private readonly pluginRegistry: PluginRegistry,
    private readonly apiBaseUrl: string,
  ) {
    this.contactHandler = new ContactDirectiveHandler(this.contactRepo, this.eventRepo, this.gateway);
    this.handoffHandler = new HandoffDirectiveHandler(this.handoffUseCase);
  }

  async execute(input: ProcessAiResponseInput): Promise<void> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation || !conversation.agentId) return;

    const agent = await this.agentRepo.findById(conversation.agentId);
    if (!agent || agent.type !== AgentType.AI) return;

    const config = await this.configRepo.findByAgentId(agent.id);
    if (!config || !config.isActive) return;

    // Debounce idempotency check: if pendingAiSince is null, another job already processed this
    if (config.multiMessage?.enabled && !conversation.pendingAiSince) {
      this.logger.debug(`Skipping AI response for ${input.conversationId} — already processed (pendingAiSince is null)`);
      return;
    }

    // Debounce freshness check: if there are newer messages within debounce window, let the newer job handle it
    if (config.multiMessage?.enabled && input.scheduledFor) {
      const scheduledTime = new Date(input.scheduledFor).getTime();
      const hardCap = conversation.pendingAiSince!.getTime() + config.multiMessage.debounceMaxWaitMs;
      const isHardCap = scheduledTime >= hardCap;

      if (!isHardCap) {
        const lastInbound = conversation.lastInboundAt.getTime();
        const debounceDeadline = lastInbound + config.multiMessage.debounceWindowMs;
        if (debounceDeadline > scheduledTime) {
          this.logger.debug(`Skipping AI response for ${input.conversationId} — newer messages arrived, a later job will handle it`);
          return;
        }
      }
    }

    // Check rate limits
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

    // Pre-check handoff rules (keyword-based, fast path) — scan recent inbound messages
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

    // ── Build plugin context & collect prompt contributions ──────────────
    const enabledPlugins = phone.plugins ?? [];

    const pluginCtx: PluginContext = {
      conversationId: conversation.id,
      contactId: conversation.contactId,
      phoneNumberId: conversation.phoneNumberId,
      tenantId: conversation.tenantId,
      agentId: agent.id,
      agentName: agent.name,
      phone,
      contact: contact ? {
        name: contact.name,
        phone: contact.phone ?? undefined,
        email: contact.email ?? undefined,
        company: contact.company ?? undefined,
        notes: contact.notes ?? undefined,
        customFields: contact.customFields ?? undefined,
      } : null,
      tenantLabels: tenantLabels.map((l: any) => ({ id: l.id, name: l.name, color: l.color })),
      conversationSummary: conversation.summary ?? null,
    };

    const { intentSections, responseSections } = await this.pluginRegistry.buildAllPromptContributions(
      pluginCtx,
      enabledPlugins,
    );

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateCtx = {
      currentDay: days[now.getDay()],
      currentDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    this.logger.log(`Conversation ${input.conversationId}: ${messages.length} messages loaded`);

    // ── STEP 1: Intent Detection ─────────────────────────────────────────
    const contactData = contact ? {
      name: contact.name,
      phone: contact.phone ?? undefined,
      email: contact.email ?? undefined,
      company: contact.company ?? undefined,
      notes: contact.notes ?? undefined,
      customFields: contact.customFields ?? undefined,
    } : undefined;

    const intentPrompt = buildIntentPrompt({
      ...dateCtx,
      contact: contactData,
      conversationSummary: conversation.summary ?? undefined,
      knowledgeBase: config.knowledgeBase || undefined,
      goals: config.goals || undefined,
      labels: tenantLabels.map((l: any) => l.name),
      handoffRules: {
        keywords: config.handoffRules.keywords,
        urgencyKeywords: config.handoffRules.urgencyKeywords,
        onCustomerRequest: config.handoffRules.onCustomerRequest,
      },
      pluginSections: intentSections,
    });

    // Send typing indicator while LLM is processing
    const typingParams = {
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: (contact ?? await this.contactRepo.findById(conversation.contactId))!.waId,
    };
    const typingLoop = this.startTypingLoop(typingParams);

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
      typingLoop.stop();
      this.logger.error(`AI intent step failed for agent ${agent.id}: ${error.message}`, error.stack);
      throw error;
    }

    this.logger.debug(`Step 1 raw output: ${intentLlmResult.content}`);
    const intentResult = this.parseIntentResult(intentLlmResult.content);
    this.logger.log(`[CognitiveLoop] Step 1 - Intent: "${intentResult.intent}", confidence: ${intentResult.confidence}, actions: ${intentResult.actions.length}`);

    // ── Execute Actions ──────────────────────────────────────────────────
    const actionResults: ActionExecutionResult[] = [];
    let pendingHandoff: { reason: string; summary: string | null } | null = null;

    const sortedActions = this.sortActionsByPriority(intentResult.actions);

    for (const action of sortedActions) {
      if (pendingHandoff && action.type !== 'escalate') continue;

      // Try plugin handler first
      const plugin = this.pluginRegistry.findPluginForAction(action.type, enabledPlugins);
      if (plugin) {
        try {
          const pluginResult = await plugin.executeAction(action, pluginCtx, actionResults);
          if (pluginResult.handled) {
            actionResults.push({ action, success: true, result: pluginResult.result });
            continue;
          }
        } catch (error: any) {
          this.logger.warn(`Plugin action ${action.type} failed: ${error.message}`);
          actionResults.push({ action, success: false, error: error.message });
          continue;
        }
      }

      // Core action handlers
      try {
        const result = await this.executeCoreAction(action, {
          conversationId: conversation.id,
          contactId: conversation.contactId,
          tenantId: conversation.tenantId,
          agentId: agent.id,
          agentName: agent.name,
          tenantLabels,
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

    // ── Plugin post-actions (state machines, directives) ─────────────────
    const pluginDirectives = await this.pluginRegistry.runAfterActions(
      pluginCtx,
      enabledPlugins,
      intentResult,
      actionResults,
    );

    // ── STEP 2: Response Generation ──────────────────────────────────────
    const responsePrompt = buildResponsePrompt({
      ...dateCtx,
      persona: config.persona,
      adminSystemPrompt: config.systemPrompt || undefined,
      knowledgeBase: config.knowledgeBase || undefined,
      contact: contactData,
      conversationSummary: conversation.summary ?? undefined,
      intentResult,
      actionResults,
      pendingHandoff: !!pendingHandoff,
      pluginSections: responseSections,
      pluginDirectives,
      multiMessage: config.multiMessage?.enabled ? { enabled: true, maxBubbles: config.multiMessage.maxBubbles } : undefined,
    });

    // Refresh typing indicator for Step 2
    typingLoop.refresh();

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
      typingLoop.stop();
      this.logger.error(`AI response step failed for agent ${agent.id}: ${error.message}`, error.stack);
      throw error;
    }

    typingLoop.stop();

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

    // Parse into multiple bubbles if multi-message is enabled
    const bubbles = config.multiMessage?.enabled
      ? this.parseMultiMessageResponse(responseContent, config.multiMessage.maxBubbles)
      : [responseContent];

    this.logger.log(`[CognitiveLoop] Step 2 - Response: ${bubbles.length} bubble(s), ${responseContent.length} chars total`);

    // ── Send & Record ────────────────────────────────────────────────────
    const sendContact = contact ?? await this.contactRepo.findById(conversation.contactId);
    if (!sendContact) return;

    // Record usage (both calls combined) — count each bubble as a message
    const totalTokens = intentLlmResult.tokensUsed.total + responseLlmResult.tokensUsed.total;
    await this.usageRepo.incrementUsage(config.tenantId, agent.id, today, bubbles.length, totalTokens);

    for (let i = 0; i < bubbles.length; i++) {
      if (i > 0) {
        // Typing indicator + delay between bubbles for natural feel
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

    // ── Send menu image if action resolved one ──────────────────────────
    const menuImageAction = actionResults.find(
      (r) => r.action.type === 'send_menu_image' && r.success && r.result?.startsWith('menu_image_url:'),
    );
    if (menuImageAction) {
      const mediaUrl = menuImageAction.result!.replace('menu_image_url:', '');

      this.messagingApi.sendTypingIndicator(typingParams).catch(() => {});
      await new Promise((r) => setTimeout(r, config.multiMessage?.interBubbleDelayMs ?? 1200));

      const { waMessageId: imgWaId } = await this.messagingApi.sendMessage({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        to: sendContact.waId,
        type: MessageType.IMAGE,
        body: '',
        mediaUrl,
      });

      const imgMessage = await this.messageRepo.upsertByWaMessageId({
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.IMAGE,
        body: null,
        mediaUrl,
        mimeType: mediaUrl.endsWith('.png') ? 'image/png' : 'image/jpeg',
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
      return this.validateIntentResult(JSON.parse(raw));
    } catch {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        try {
          return this.validateIntentResult(JSON.parse(fenceMatch[1].trim()));
        } catch { /* fall through */ }
      }

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

  private async resolveMenuImageUrl(tenantId: string): Promise<string | null> {
    for (const ext of ['jpeg', 'jpg', 'png']) {
      const filePath = join(process.cwd(), 'public', 'menus', `${tenantId}.${ext}`);
      try {
        await access(filePath);
        return `${this.apiBaseUrl}/public/menus/${tenantId}.${ext}`;
      } catch {
        // file not found, try next extension
      }
    }
    return null;
  }

  private sortActionsByPriority(actions: CognitiveAction[]): CognitiveAction[] {
    const corePriority: Record<string, number> = {
      escalate: 0,
      update_contact: 3,
      add_label: 4,
      remove_label: 5,
      update_summary: 6,
      complete_goal: 7,
      send_menu_image: 90,
      respond: 99,
    };
    return [...actions].sort((a, b) => (corePriority[a.type] ?? 50) - (corePriority[b.type] ?? 50));
  }

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

    // Try direct parse
    let result = tryParse(raw);
    if (result) return result.slice(0, maxBubbles);

    // Try extracting JSON array from code fences
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      result = tryParse(fenceMatch[1].trim());
      if (result) return result.slice(0, maxBubbles);
    }

    // Try extracting bare JSON array
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      result = tryParse(arrayMatch[0]);
      if (result) return result.slice(0, maxBubbles);
    }

    // Fallback: treat as single message
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

  private async executeCoreAction(
    action: CognitiveAction,
    ctx: {
      conversationId: string;
      contactId: string;
      tenantId: string;
      agentId: string;
      agentName: string;
      tenantLabels: any[];
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
        return `Handoff scheduled: ${action.params.reason}`;

      case 'send_menu_image': {
        const url = await this.resolveMenuImageUrl(ctx.tenantId);
        return url ? `menu_image_url:${url}` : 'No menu image available';
      }

      case 'respond':
        return 'No action needed';

      default:
        return `Unknown action type: ${action.type}`;
    }
  }
}
