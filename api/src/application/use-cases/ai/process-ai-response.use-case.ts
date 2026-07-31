import { Logger } from '@nestjs/common';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import { AiUsageRepository } from '../../../domain/repositories/ai-usage.repository.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import { AiCompletionPort } from '../../ports/ai-completion.port.js';
import type { ChatMessage } from '../../ports/ai-completion.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { HandoffToHumanUseCase } from './handoff-to-human.use-case.js';
import { HandoffDetectionDomainService } from '../../../domain/services/handoff-detection.domain-service.js';
import { ContactDirectiveHandler } from './handlers/contact-directive.handler.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import {
  buildAgentSystemPrompt,
  buildChatHistory,
  parseMultiMessageResponse,
  sendBubbles,
  stripTimestampPrefixes,
} from './ai-run.helpers.js';
import { ToolRegistry } from './tools/tool-registry.js';
import type { ToolContext } from './tools/tool-registry.js';
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
    private readonly flowExecRepo: FlowExecutionRepository,
    private readonly devEvents: DeveloperEventsPort,
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

    // Un flujo activo es el dueño exclusivo de la conversación: un job de IA
    // encolado por un mensaje anterior no debe hablarle al cliente en paralelo.
    const activeFlow = await this.flowExecRepo.findActiveByConversationId(input.conversationId);
    if (activeFlow) {
      this.logger.debug(`Skipping AI response for ${input.conversationId} — un flujo tiene la conversación`);
      return;
    }

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

    // ── Build system prompt ─────────────────────────────────────────────
    const systemPrompt = buildAgentSystemPrompt({
      config,
      contact,
      conversationSummary: conversation.summary ?? null,
      labels: tenantLabels.map((l: any) => l.name),
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

    // ── Build chat history ──────────────────────────────────────────────
    const chatHistory: ChatMessage[] = buildChatHistory(messages);

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
    let totalTokens = { prompt: 0, completion: 0, total: 0 };
    const loopMessages: ChatMessage[] = [...chatHistory];

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.aiCompletion.complete({
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
    const responseContent = stripTimestampPrefixes(finalContent);

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
      ? parseMultiMessageResponse(responseContent, config.multiMessage.maxBubbles, this.logger)
      : [responseContent];

    this.logger.log(`Response: ${bubbles.length} bubble(s), ${responseContent.length} chars total`);

    // La llamada al LLM tarda segundos: un flujo pudo tomar la conversación
    // mientras tanto. Se revalida justo antes de escribirle al cliente.
    const flowTookOver = await this.flowExecRepo.findActiveByConversationId(input.conversationId);
    if (flowTookOver) {
      this.logger.debug(`Descartando respuesta IA de ${input.conversationId} — un flujo tomó la conversación`);
      await this.conversationRepo.update(input.conversationId, { pendingAiSince: null } as any);
      return;
    }

    // ── Send & Record ───────────────────────────────────────────────────
    await this.usageRepo.incrementUsage(config.tenantId, agent.id, today, bubbles.length, totalTokens.total);

    await sendBubbles({
      messagingApi: this.messagingApi,
      messageRepo: this.messageRepo,
      gateway: this.gateway,
      phone,
      contactWaId: sendContact.waId,
      conversationId: conversation.id,
      senderAgentId: agent.id,
      senderAgentName: agent.name,
      bubbles,
      interBubbleDelayMs: config.multiMessage?.interBubbleDelayMs ?? 1200,
      devEvents: this.devEvents,
      tenantId: conversation.tenantId,
    });

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

  private startTypingLoop(params: import('../../ports/messaging-api.port.js').TypingIndicatorParams): { stop: () => void; refresh: () => void } {
    const send = () => { this.messagingApi.sendTypingIndicator(params).catch(() => {}); };
    send();
    let timer: ReturnType<typeof setInterval> = setInterval(send, 20_000);
    return {
      stop: () => { clearInterval(timer); },
      refresh: () => { clearInterval(timer); send(); timer = setInterval(send, 20_000); },
    };
  }
}
