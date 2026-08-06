// ── Router de mensajes entrantes (paso 5c del pipeline) ──────────
// Decide si un flujo consume el mensaje. Si devuelve true, el caller
// suprime auto-assign y el enqueue del bot IA para este mensaje.

import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import type { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { MessageRepository } from '../../../domain/repositories/message.repository.js';
import type { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import type { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import type { JobQueuePort } from '../../ports/job-queue.port.js';
import type { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { Contact } from '../../../domain/entities/contact.entity.js';
import { Message, messageToText } from '../../../domain/entities/message.entity.js';
import type { FlowVersion } from '../../../domain/entities/flow-version.entity.js';
import { FlowExecutionStatus } from '../../../domain/enums/flow-execution-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { normalizeText } from './engine/flow-variable.resolver.js';
import { isTrigger } from './engine/flow-node-types.js';
import { FLOW_EXECUTE_JOB, FLOW_RESUME_JOB, FlowResumeJobData } from './flow-jobs.constants.js';

const TRIGGER_STORM_LIMIT = 10; // ejecuciones por conversación por hora

export interface FlowRouteInput {
  tenantId: string;
  phoneId: string;
  conversation: Conversation;
  contact: Contact;
  message: Message;
  created: boolean;
  /** Primera respuesta del contacto a una conversación nacida de una campaña */
  promotedFromCampaign: boolean;
}

export class FlowInboundRouterUseCase {
  private readonly logger = new Logger(FlowInboundRouterUseCase.name);

  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
    private readonly execRepo: FlowExecutionRepository,
    private readonly agentRepo: AgentRepository,
    private readonly messageRepo: MessageRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly jobQueue: JobQueuePort,
    private readonly devEvents: DeveloperEventsPort,
  ) {}

  async route(input: FlowRouteInput): Promise<boolean> {
    // A/B: ¿hay una ejecución viva en esta conversación?
    const active = await this.execRepo.findActiveByConversationId(input.conversation.id);
    if (active) return this.handleActive(active, input);

    // C: matchear triggers de flujos publicados.
    const flows = await this.flowRepo.findPublishedByTenantId(input.tenantId);
    if (flows.length === 0) return false;

    const versionIds = flows.map((f) => f.publishedVersionId).filter((id): id is string => !!id);
    const versions = await this.versionRepo.findByIds(versionIds);
    const versionById = new Map(versions.map((v) => [v.id, v]));

    // Cache del tipo del agente asignado (para ignoreIfAssignedToHuman).
    let assignedIsHuman: boolean | null = null;
    const isAssignedToHuman = async (): Promise<boolean> => {
      if (assignedIsHuman !== null) return assignedIsHuman;
      if (!input.conversation.agentId) return (assignedIsHuman = false);
      const agent = await this.agentRepo.findById(input.conversation.agentId);
      return (assignedIsHuman = !!agent && agent.type === AgentType.HUMAN);
    };

    for (const flow of flows) {
      const version = flow.publishedVersionId ? versionById.get(flow.publishedVersionId) : undefined;
      if (!version) continue;

      if (version.trigger.type === 'campaign_reply') {
        if (!input.promotedFromCampaign) continue;
        if (!(await this.campaignTriggerMatches(version, input))) continue;
      } else if (version.trigger.type === 'inbound_message') {
        if (!(await this.triggerMatches(version, input, isAssignedToHuman))) continue;
      } else {
        continue; // webhook: no se dispara desde mensajes entrantes
      }

      // Guard anti-tormenta: si algo loopea, dejamos actuar al pipeline legado.
      const recentStarts = await this.execRepo.countStartedSince(
        input.conversation.id,
        new Date(Date.now() - 60 * 60 * 1000),
      );
      if (recentStarts >= TRIGGER_STORM_LIMIT) {
        this.logger.warn(`Trigger storm en conversación ${input.conversation.id}: se omite el flujo ${flow.id}`);
        return false;
      }

      return this.startExecution(flow.id, version, input);
    }

    return false;
  }

  private async handleActive(
    active: { id: string; status: FlowExecutionStatus; resumeToken: string; waitState: { kind: string } | null },
    input: FlowRouteInput,
  ): Promise<boolean> {
    if (active.status === FlowExecutionStatus.WAITING && active.waitState?.kind === 'reply') {
      await this.jobQueue.enqueue(FLOW_RESUME_JOB, {
        executionId: active.id,
        token: active.resumeToken,
        reason: 'reply',
        messageId: input.message.id,
        interactiveReplyId: input.message.interactiveReplyId,
        // Una ubicación se responde con su texto: si no, el nodo "Preguntar"
        // recibía vacío y repreguntaba aunque el cliente ya había contestado.
        body: messageToText(input.message) || null,
      } satisfies FlowResumeJobData);
      return true;
    }
    // running o waiting(delay): el flujo es dueño; el mensaje queda en el
    // historial. Los mensajes durante un delay NO responden preguntas futuras.
    return true;
  }

  /**
   * Trigger por respuesta de campaña: se limita a la línea y, si el tenant lo
   * configuró, a campañas concretas. La campaña se identifica por el
   * `campaignId` que el envío estampó en el mensaje saliente.
   */
  private async campaignTriggerMatches(version: FlowVersion, input: FlowRouteInput): Promise<boolean> {
    const trigger = version.trigger;
    if (trigger.phoneNumberIds.length > 0 && !trigger.phoneNumberIds.includes(input.phoneId)) return false;
    if (trigger.campaignIds.length === 0) return true;

    const { data } = await this.messageRepo.findByConversationId(input.conversation.id, 1, 20);
    const campaignId = data.find((m) => m.campaignId)?.campaignId;
    return !!campaignId && trigger.campaignIds.includes(campaignId);
  }

  private async triggerMatches(
    version: FlowVersion,
    input: FlowRouteInput,
    isAssignedToHuman: () => Promise<boolean>,
  ): Promise<boolean> {
    const trigger = version.trigger;

    if (trigger.phoneNumberIds.length > 0 && !trigger.phoneNumberIds.includes(input.phoneId)) return false;
    if (trigger.onlyNewConversations && !input.created) return false;
    if (trigger.ignoreIfAssignedToHuman && (await isAssignedToHuman())) return false;

    if (trigger.match === 'keywords') {
      const body = normalizeText(input.message.body ?? '');
      if (!body) return false;
      const matched = trigger.keywords.some((keyword) => {
        const normalized = normalizeText(keyword);
        if (!normalized) return false;
        return trigger.keywordMode === 'exact' ? body === normalized : body.includes(normalized);
      });
      if (!matched) return false;
    }

    return true;
  }

  private async startExecution(flowId: string, version: FlowVersion, input: FlowRouteInput): Promise<boolean> {
    const triggerNode = version.graph.nodes.find((n) => isTrigger(n.type));
    if (!triggerNode) return false;

    const token = randomBytes(16).toString('hex');
    const execution = await this.execRepo.tryCreateActive({
      tenantId: input.tenantId,
      flowId,
      flowVersionId: version.id,
      conversationId: input.conversation.id,
      contactId: input.contact.id,
      phoneNumberId: input.phoneId,
      status: FlowExecutionStatus.RUNNING,
      currentNodeId: triggerNode.id,
      resumeToken: token,
      stepCount: 0,
      waitState: null,
      // El mensaje que disparó el flujo ya se "consumió" acá: si el job
      // entrante se reintenta, no debe volver a rutearse como respuesta a la
      // primera espera del flujo.
      lastConsumedMessageId: input.message.id,
      variables: {
        message: { body: messageToText(input.message), type: input.message.messageType },
        vars: {},
      },
      steps: [],
      triggeredBy: { type: 'message', messageId: input.message.id },
      endReason: null,
      error: null,
      runningSince: new Date(),
      startedAt: new Date(),
      endedAt: null,
    });

    if (!execution) {
      // E11000: otra ejecución ganó la carrera — rutear contra la ganadora,
      // jamás caer al pipeline legado con un flujo activo.
      const winner = await this.execRepo.findActiveByConversationId(input.conversation.id);
      if (winner) return this.handleActive(winner, input);
      return true;
    }

    await this.flowRepo.incrementStats(flowId, { started: 1 });
    try {
      const flow = await this.flowRepo.findById(flowId);
      const event = await this.eventRepo.create({
        conversationId: input.conversation.id,
        tenantId: input.tenantId,
        type: ConversationEventType.FLOW_STARTED,
        performedBy: null,
        data: { flowId, flowName: flow?.name ?? 'Automatización' },
      });
      this.gateway.emitToConversation(input.conversation.id, 'conversation.event', event);
    } catch (error: any) {
      this.logger.warn(`No se pudo crear el evento FLOW_STARTED: ${error?.message}`);
    }
    this.gateway.emitToTenant(input.tenantId, 'flow.execution.started', {
      flowId,
      executionId: execution.id,
      conversationId: input.conversation.id,
    });
    this.devEvents.emit(input.tenantId, DeveloperEventType.FLOW_STARTED, {
      flowId,
      executionId: execution.id,
      conversationId: input.conversation.id,
      contactId: input.contact.id,
      trigger: 'inbound_message',
    });

    await this.jobQueue.enqueue(FLOW_EXECUTE_JOB, { executionId: execution.id, token });
    return true;
  }
}
