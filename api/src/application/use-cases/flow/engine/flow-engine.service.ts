// ── Motor de ejecución de flujos ─────────────────────────────────
// Invariantes:
// - Máx. 1 ejecución viva por conversación (índice único parcial en Mongo).
// - resumeToken es un fencing token: TODO camino de avance (execute, resume,
//   timeout, continuación) debe ganar un findOneAndUpdate CAS sobre
//   {_id, status, resumeToken}. Jobs con token viejo mueren en silencio.
// - Efectos at-most-once: cursor persistido tras cada nodo, jobs sin retry.

import { Logger } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';
import type { FlowRepository } from '../../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../../domain/repositories/flow-version.repository.js';
import type { FlowExecutionRepository } from '../../../../domain/repositories/flow-execution.repository.js';
import type { FlowNodeStatRepository } from '../../../../domain/repositories/flow-node-stat.repository.js';
import type { FlowConnectionRepository } from '../../../../domain/repositories/flow-connection.repository.js';
import type { ConversationRepository } from '../../../../domain/repositories/conversation.repository.js';
import { adVariables } from '../../../../domain/value-objects/message-referral.js';
import type { ContactRepository } from '../../../../domain/repositories/contact.repository.js';
import type { PhoneNumberRepository } from '../../../../domain/repositories/phone-number.repository.js';
import type { AgentRepository } from '../../../../domain/repositories/agent.repository.js';
import type { AgentPhoneAccessRepository } from '../../../../domain/repositories/agent-phone-access.repository.js';
import type { TenantRepository } from '../../../../domain/repositories/tenant.repository.js';
import { resolveAiPersona } from '../../../../domain/value-objects/ai-persona.js';
import type { AiUsageRepository } from '../../../../domain/repositories/ai-usage.repository.js';
import type { MessageRepository } from '../../../../domain/repositories/message.repository.js';
import type { LabelRepository } from '../../../../domain/repositories/label.repository.js';
import type { ConversationLabelRepository } from '../../../../domain/repositories/conversation-label.repository.js';
import type { ConversationNoteRepository } from '../../../../domain/repositories/conversation-note.repository.js';
import type { ConversationEventRepository } from '../../../../domain/repositories/conversation-event.repository.js';
import type { MessageTemplateRepository } from '../../../../domain/repositories/message-template.repository.js';
import type { MediaAssetRepository } from '../../../../domain/repositories/media-asset.repository.js';
import type { MediaAsset } from '../../../../domain/entities/media-asset.entity.js';
import { isBsuidOnly, recipientIdentityOf, templateRequiresPhone } from '../../../../domain/value-objects/recipient-identity.js';
import type { MessageSenderKind } from '../../../../domain/entities/message.entity.js';
import { billingForConversation, type OutboundBillingExtras } from '../../billing/outbound-billing.helper.js';
import { MediaKind } from '../../../../domain/enums/media-kind.enum.js';
import type { MediaAccessService } from '../../media/media-access.service.js';
import type { FlowSecretsPort } from '../../../ports/flow-secrets.port.js';
import type { FlowHttpPort } from '../../../ports/flow-http.port.js';
import type { MessagingApiPort, InteractiveSendPayload } from '../../../ports/messaging-api.port.js';
import type { AiCompletionPort } from '../../../ports/ai-completion.port.js';
import type { RealtimeGatewayPort } from '../../../ports/realtime-gateway.port.js';
import type { JobQueuePort } from '../../../ports/job-queue.port.js';
import type { DeveloperEventsPort } from '../../../ports/developer-events.port.js';
import { DeveloperEventType } from '../../../../domain/enums/developer-event-type.enum.js';
import type { AutoAssignConversationUseCase } from '../../conversation/auto-assign-conversation.use-case.js';
import { Flow } from '../../../../domain/entities/flow.entity.js';
import type { FlowNode } from '../../../../domain/entities/flow.entity.js';
import { FlowVersion } from '../../../../domain/entities/flow-version.entity.js';
import { FlowExecution, FlowStepLog, FlowWaitState } from '../../../../domain/entities/flow-execution.entity.js';
import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { Contact } from '../../../../domain/entities/contact.entity.js';
import { PhoneNumber } from '../../../../domain/entities/phone-number.entity.js';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';
import { ConversationEventType } from '../../../../domain/enums/conversation-event-type.enum.js';
import { AgentType } from '../../../../domain/enums/agent-type.enum.js';
import { AgentStatus } from '../../../../domain/enums/agent-status.enum.js';
import { MessageDirection } from '../../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';
import { TemplateStatus } from '../../../../domain/enums/template-status.enum.js';
import { HandoffDetectionDomainService } from '../../../../domain/services/handoff-detection.domain-service.js';
import { buildTemplatePayload } from '../../campaign/helpers/template-variable.resolver.js';
import {
  buildAgentSystemPrompt,
  buildChatHistory,
  lastInboundOf,
  parseMultiMessageResponse,
  sendBubbles,
  stripTimestampPrefixes,
} from '../../ai/ai-run.helpers.js';
import { toMessageLocation, type MessageLocation } from '../../../../domain/value-objects/message-location.js';
import { FLOW_EXECUTE_JOB, FLOW_RESUME_JOB, FlowResumeJobData } from '../flow-jobs.constants.js';
import { renderTemplate, renderJsonTemplate, resolvePath, normalizeText, FlowVariableContext } from './flow-variable.resolver.js';
import { matchReply, validateAnswer, parseLatamNumber } from './flow-reply.matcher.js';
import { durationToMs, DEFAULT_REPLY_TIMEOUT_MS, MAX_WAIT_MS, isTrigger } from './flow-node-types.js';

const AI_RESPONSE_JOB = 'ai.process-response';
const STEP_BUDGET_PER_RUN = 20;
const MAX_STEPS = 200;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REPROMPTS = 2;
/** Meta baja el indicador de tipeo a los 25 s: esperar más muestra un chat mudo. */
const TYPING_MAX_SECONDS = 25;

/** Cuando el archivo viene por URL el tipo lo dice el nodo: no hay asset que preguntarle. */
const URL_MEDIA_MESSAGE_TYPES: Record<string, MessageType> = {
  image: MessageType.IMAGE,
  video: MessageType.VIDEO,
  audio: MessageType.AUDIO,
  document: MessageType.DOCUMENT,
  sticker: MessageType.STICKER,
};

/** Meta rechaza el pie de foto en estos: no llevan texto acompañante. */
const MEDIA_TYPES_WITHOUT_CAPTION = new Set<MessageType>([MessageType.AUDIO, MessageType.STICKER]);

/** El archivo elegido define el tipo de mensaje, no lo que dice el nodo. */
const FLOW_MEDIA_MESSAGE_TYPES: Record<MediaKind, MessageType> = {
  [MediaKind.IMAGE]: MessageType.IMAGE,
  [MediaKind.VIDEO]: MessageType.VIDEO,
  [MediaKind.AUDIO]: MessageType.AUDIO,
  [MediaKind.DOCUMENT]: MessageType.DOCUMENT,
  [MediaKind.STICKER]: MessageType.STICKER,
};

type NodeResult =
  | { kind: 'advance'; handle: string; note?: string; skipped?: boolean; isError?: boolean }
  | { kind: 'wait'; wait: FlowWaitState; sentAt: Date }
  | { kind: 'end'; endReason: string; note?: string; delegateToAiNodeId?: string }
  | { kind: 'error'; message: string };

interface RunCtx {
  execId: string;
  tenantId: string;
  token: string;
  flow: Flow;
  version: FlowVersion;
  conversation: Conversation;
  contact: Contact;
  phone: PhoneNumber;
  variables: Record<string, unknown>;
}

/**
 * Contabilidad de un saliente del flujo. Se arma desde el contexto de la
 * ejecución para que ningún nodo tenga que acordarse de armarla a mano.
 */
function flowBilling(ctx: RunCtx, extras: Omit<OutboundBillingExtras, 'senderKind'> & { senderKind?: MessageSenderKind } = {}) {
  const { senderKind = 'flow', ...rest } = extras;
  return billingForConversation(ctx.conversation, ctx.contact, {
    senderKind,
    flowId: ctx.flow.id,
    ...rest,
  });
}

function freshToken(): string {
  return randomBytes(16).toString('hex');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name);
  private readonly handoffDetection = new HandoffDetectionDomainService();

  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
    private readonly execRepo: FlowExecutionRepository,
    private readonly statRepo: FlowNodeStatRepository,
    private readonly connectionRepo: FlowConnectionRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly usageRepo: AiUsageRepository,
    private readonly messageRepo: MessageRepository,
    private readonly labelRepo: LabelRepository,
    private readonly convLabelRepo: ConversationLabelRepository,
    private readonly noteRepo: ConversationNoteRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly secrets: FlowSecretsPort,
    private readonly http: FlowHttpPort,
    private readonly messagingApi: MessagingApiPort,
    private readonly aiCompletion: AiCompletionPort,
    private readonly gateway: RealtimeGatewayPort,
    private readonly jobQueue: JobQueuePort,
    private readonly autoAssign: AutoAssignConversationUseCase,
    private readonly devEvents: DeveloperEventsPort,
    private readonly accessRepo: AgentPhoneAccessRepository,
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
  ) {}

  // ── Entradas desde los jobs ────────────────────────────────────

  /** Handler de flow.execute: reclama la ejecución y corre el loop de pasos */
  async runExecution(executionId: string, token: string): Promise<void> {
    const claimed = await this.execRepo.casClaim(executionId, FlowExecutionStatus.RUNNING, token, {
      resumeToken: freshToken(),
      runningSince: new Date(),
    });
    if (!claimed) return; // job viejo / cancelada / ya reclamada

    const ctx = await this.loadCtx(claimed);
    if (!ctx) return;
    await this.runLoop(ctx, claimed);
  }

  /** Handler de flow.resume: respuesta del cliente o timeout de una espera */
  async resume(input: FlowResumeJobData): Promise<void> {
    const exec = await this.execRepo.findById(input.executionId);
    if (!exec || exec.status !== FlowExecutionStatus.WAITING) return;
    if (exec.resumeToken !== input.token || !exec.waitState) return;
    const waitState = exec.waitState;

    // Reentrega del mismo mensaje (retry del job entrante / redelivery de Meta):
    // el token de la espera actual es válido, pero este mensaje ya reanudó una
    // espera anterior y no debe contestar la pregunta siguiente.
    if (input.reason === 'reply' && input.messageId && exec.lastConsumedMessageId === input.messageId) {
      this.logger.debug(`Resume ignorado en ${exec.id}: mensaje ${input.messageId} ya consumido`);
      return;
    }

    const claimed = await this.execRepo.casClaim(exec.id, FlowExecutionStatus.WAITING, input.token, {
      status: FlowExecutionStatus.RUNNING,
      resumeToken: freshToken(),
      waitState: null,
      runningSince: new Date(),
      ...(input.reason === 'reply' && input.messageId ? { lastConsumedMessageId: input.messageId } : {}),
    });
    if (!claimed) return; // otro camino ganó (respuesta vs timeout): un solo CAS decide

    const ctx = await this.loadCtx(claimed);
    if (!ctx) return;

    const node = ctx.version.graph.nodes.find((n) => n.id === waitState.nodeId);
    if (!node) {
      return this.finish(ctx, FlowExecutionStatus.FAILED, 'missing_node', {
        nodeId: waitState.nodeId,
        message: 'El nodo de espera ya no existe en la versión publicada',
      });
    }

    const startMs = Date.now();
    let handle: string;
    let note: string | null = null;

    if (input.reason === 'timeout') {
      handle = waitState.kind === 'delay' ? 'out' : 'timeout';
    } else if (node.type === 'action.send_flow') {
      const respuesta = input.messageId
        ? ((await this.messageRepo.findById(input.messageId))?.interactivePayload as
            | { kind?: string; token?: string; fields?: Record<string, unknown> }
            | null)
        : null;
      const esDeEsteNodo = respuesta?.kind === 'flow_response' && respuesta.token === `${ctx.execId}:${node.id}`;

      if (esDeEsteNodo) {
        handle = 'completed';
        const fields = respuesta.fields ?? {};
        if (waitState.saveAs) this.setVar(ctx, waitState.saveAs, fields);
        note = Object.keys(fields).slice(0, 4).join(', ') || 'formulario completado';
      } else if (waitState.attempts < MAX_REPROMPTS) {
        // Escribir mientras el formulario está abierto no lo completa: se le
        // recuerda que tiene que tocar el botón.
        return this.reprompt(ctx, node, waitState);
      } else {
        handle = 'timeout';
        note = 'no completó el formulario';
      }
    } else if (node.type === 'action.request_location') {
      const coords = input.messageId ? (await this.messageRepo.findById(input.messageId))?.location ?? null : null;
      if (coords) {
        handle = 'reply';
        if (waitState.saveAs) {
          this.setVar(ctx, waitState.saveAs, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            name: coords.name ?? '',
            address: coords.address ?? '',
          });
        }
        note = `${coords.latitude}, ${coords.longitude}`;
      } else if (waitState.attempts < MAX_REPROMPTS) {
        return this.reprompt(ctx, node, waitState);
      } else {
        handle = 'invalid';
        note = 'no mandó una ubicación';
      }
    } else if (node.type === 'action.ask') {
      const body = (input.body ?? '').trim();
      if (validateAnswer(waitState.validation, body)) {
        handle = 'reply';
        // Los números se guardan como número: así interpolan como literal JSON
        // válido en el nodo HTTP (p. ej. el monto de un link de pago).
        const value = waitState.validation === 'numero' ? (parseLatamNumber(body) ?? body) : body;
        if (waitState.saveAs) this.setVar(ctx, waitState.saveAs, value);
        await this.applySaveToContact(ctx, node, body);
      } else if (waitState.attempts < MAX_REPROMPTS) {
        return this.reprompt(ctx, node, waitState);
      } else {
        handle = 'invalid';
        note = 'respuesta inválida tras reintentos';
      }
    } else {
      // buttons / list
      const match = matchReply(waitState, input.interactiveReplyId ?? null, input.body ?? null);
      if (match) {
        handle = match.handle;
        const title = this.optionTitle(node, match.handle) ?? input.body ?? '';
        if (waitState.saveAs) this.setVar(ctx, waitState.saveAs, title);
        note = title;
      } else {
        const hasOther = ctx.version.graph.edges.some((e) => e.source === node.id && e.sourceHandle === 'other');
        if (hasOther) {
          handle = 'other';
          if (waitState.saveAs) this.setVar(ctx, waitState.saveAs, input.body ?? '');
        } else if (waitState.attempts < MAX_REPROMPTS) {
          return this.reprompt(ctx, node, waitState);
        } else {
          handle = 'timeout';
          note = 'sin respuesta válida tras reintentos';
        }
      }
    }

    await this.continueFrom(ctx, node, handle, note, startMs);
  }

  /** Sweep: ejecuciones colgadas (crash) y esperas con wake perdido */
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);

    const stale = await this.execRepo.findStaleRunning(cutoff);
    for (const exec of stale) {
      const claimed = await this.execRepo.casClaim(exec.id, FlowExecutionStatus.RUNNING, exec.resumeToken, {
        status: FlowExecutionStatus.FAILED,
        endReason: 'stalled',
        error: { nodeId: exec.currentNodeId ?? '', message: 'La ejecución quedó colgada (posible caída del proceso)' },
        waitState: null,
        runningSince: null,
        endedAt: new Date(),
        resumeToken: freshToken(),
      });
      if (!claimed) continue;
      await this.afterFinish(claimed, FlowExecutionStatus.FAILED, 'stalled');
    }

    const expired = await this.execRepo.findExpiredWaiting(cutoff);
    for (const exec of expired) {
      // Wake sintetizado con el token vigente: el CAS del resume decide.
      await this.jobQueue.enqueue(FLOW_RESUME_JOB, {
        executionId: exec.id,
        token: exec.resumeToken,
        reason: 'timeout',
      } satisfies FlowResumeJobData);
    }
  }

  // ── Loop de pasos ──────────────────────────────────────────────

  private async runLoop(ctx: RunCtx, exec: FlowExecution): Promise<void> {
    let currentNodeId = exec.currentNodeId;
    let stepCount = exec.stepCount;

    for (let budget = 0; budget < STEP_BUDGET_PER_RUN; budget++) {
      if (!currentNodeId) {
        return this.finish(ctx, FlowExecutionStatus.COMPLETED, 'reached_end', null);
      }
      if (stepCount >= MAX_STEPS) {
        return this.finish(ctx, FlowExecutionStatus.FAILED, 'step_limit', {
          nodeId: currentNodeId,
          message: 'Límite de pasos alcanzado (posible loop)',
        });
      }

      const node = ctx.version.graph.nodes.find((n) => n.id === currentNodeId);
      if (!node) {
        return this.finish(ctx, FlowExecutionStatus.FAILED, 'missing_node', {
          nodeId: currentNodeId,
          message: 'Nodo inexistente en la versión publicada',
        });
      }

      const startMs = Date.now();
      let result: NodeResult;
      try {
        result = await this.executeNode(ctx, node);
      } catch (error: any) {
        this.logger.error(`Nodo ${node.type} (${node.id}) falló: ${error?.message}`, error?.stack);
        result = { kind: 'error', message: error?.message ?? 'Error inesperado' };
      }
      this.bumpStat(ctx, node.id, { entered: 1 });

      if (result.kind === 'error') {
        const hasErrorEdge = ctx.version.graph.edges.some((e) => e.source === node.id && e.sourceHandle === 'error');
        if (hasErrorEdge) {
          result = { kind: 'advance', handle: 'error', note: result.message, isError: true };
        } else {
          this.bumpStat(ctx, node.id, { errors: 1 });
          return this.finish(
            ctx,
            FlowExecutionStatus.FAILED,
            'node_error',
            { nodeId: node.id, message: result.message },
            this.stepLog(node, 'error', null, result.message, startMs),
          );
        }
      }

      if (result.kind === 'end') {
        return this.finish(
          ctx,
          FlowExecutionStatus.COMPLETED,
          result.endReason,
          null,
          this.stepLog(node, 'ok', null, result.note ?? null, startMs),
          result.delegateToAiNodeId,
        );
      }

      if (result.kind === 'wait') {
        return this.enterWait(ctx, node, result.wait, result.sentAt, startMs);
      }

      // advance
      if (result.isError) this.bumpStat(ctx, node.id, { errors: 1 });
      else this.bumpStat(ctx, node.id, { outcomeHandle: result.handle });

      const step = this.stepLog(node, result.skipped ? 'skipped' : result.isError ? 'error' : 'ok', result.handle, result.note ?? null, startMs);
      const edge = ctx.version.graph.edges.find((e) => e.source === node.id && e.sourceHandle === result.handle);
      if (!edge) {
        const failed = result.isError === true;
        return this.finish(
          ctx,
          failed ? FlowExecutionStatus.FAILED : FlowExecutionStatus.COMPLETED,
          failed ? 'node_error' : 'reached_end',
          failed ? { nodeId: node.id, message: result.note ?? 'Error' } : null,
          step,
        );
      }

      const updated = await this.execRepo.advanceCursor(
        ctx.execId,
        ctx.token,
        { currentNodeId: edge.target, variables: ctx.variables, runningSince: new Date() },
        step,
      );
      if (!updated) return; // cancelada / tomada por otro camino
      currentNodeId = edge.target;
      stepCount = updated.stepCount;
    }

    // Presupuesto agotado: rotar token y encolar continuación (fairness).
    const contToken = freshToken();
    const updated = await this.execRepo.casClaim(ctx.execId, FlowExecutionStatus.RUNNING, ctx.token, {
      resumeToken: contToken,
    });
    if (!updated) return;
    await this.jobQueue.enqueue(FLOW_EXECUTE_JOB, { executionId: ctx.execId, token: contToken });
  }

  /** Reanudación post-espera: registra el step del nodo de espera y sigue */
  private async continueFrom(ctx: RunCtx, node: FlowNode, handle: string, note: string | null, startMs: number): Promise<void> {
    this.bumpStat(ctx, node.id, { outcomeHandle: handle });
    const step = this.stepLog(node, 'ok', handle, note, startMs);
    const edge = ctx.version.graph.edges.find((e) => e.source === node.id && e.sourceHandle === handle);
    if (!edge) {
      return this.finish(ctx, FlowExecutionStatus.COMPLETED, 'reached_end', null, step);
    }
    const updated = await this.execRepo.advanceCursor(
      ctx.execId,
      ctx.token,
      { currentNodeId: edge.target, variables: ctx.variables, runningSince: new Date() },
      step,
    );
    if (!updated) return;
    await this.runLoop(ctx, updated);
  }

  private async enterWait(ctx: RunCtx, node: FlowNode, incomingWait: FlowWaitState, sentAt: Date, startMs: number): Promise<void> {
    const wait: FlowWaitState = { ...incomingWait, nodeId: node.id };
    const waitToken = freshToken();
    const updated = await this.execRepo.casClaim(ctx.execId, FlowExecutionStatus.RUNNING, ctx.token, {
      status: FlowExecutionStatus.WAITING,
      currentNodeId: node.id,
      resumeToken: waitToken,
      waitState: wait,
      variables: ctx.variables,
      runningSince: null,
    });
    if (!updated) return;

    // El timeout SIEMPRE se agenda y nunca se cancela: si la espera ya se
    // resolvió cuando dispare, su token está muerto y el CAS lo descarta.
    await this.jobQueue.schedule(
      FLOW_RESUME_JOB,
      { executionId: ctx.execId, token: waitToken, reason: 'timeout' } satisfies FlowResumeJobData,
      wait.timeoutAt,
    );

    if (wait.kind === 'reply') await this.rescheduleIfInboundArrived(ctx, waitToken, sentAt);
    void startMs;
  }

  /**
   * Recheck anti-carrera: mientras la ejecución estuvo `running` el router
   * descarta los mensajes entrantes (el flujo es dueño), así que si entró una
   * respuesta en esa ventana hay que reanudar a mano. Se compara contra
   * `conversation.lastInboundAt` —reloj del servidor, milisegundos— y NO
   * contra `message.timestamp`, que viene de Meta truncado a segundos y
   * perdería justamente las carreras sub-segundo que esto existe para cubrir.
   * Un resume duplicado es inofensivo: lo absorben el CAS del token y el
   * descarte por `lastConsumedMessageId`.
   */
  private async rescheduleIfInboundArrived(ctx: RunCtx, waitToken: string, since: Date): Promise<void> {
    const freshConv = await this.conversationRepo.findById(ctx.conversation.id);
    if (!freshConv || freshConv.lastInboundAt.getTime() <= since.getTime()) return;

    const { data } = await this.messageRepo.findByConversationId(ctx.conversation.id, 1, 5);
    const lastInbound = [...data].reverse().find((m) => m.direction === MessageDirection.INBOUND);
    if (!lastInbound) return;

    await this.jobQueue.enqueue(FLOW_RESUME_JOB, {
      executionId: ctx.execId,
      token: waitToken,
      reason: 'reply',
      messageId: lastInbound.id,
      interactiveReplyId: lastInbound.interactiveReplyId,
      body: lastInbound.body,
    } satisfies FlowResumeJobData);
  }

  /** Re-pregunta (respuesta inválida / sin match): re-entra a la espera con attempts+1 */
  private async reprompt(ctx: RunCtx, node: FlowNode, waitState: FlowWaitState): Promise<void> {
    // Ancla ANTES del envío: la ventana en que el flujo está `running` (y el
    // router descarta entrantes) arranca en el claim del resume, no en el send.
    const since = new Date();
    const data = node.data as Record<string, any>;
    const fallbackMessage =
      node.type === 'action.ask'
        ? 'Mmm, eso no parece válido. ¿Me lo repetís?'
        : node.type === 'action.request_location'
          ? 'Necesito tu ubicación: tocá el botón de acá arriba y compartila 📍'
          : node.type === 'action.send_flow'
            ? 'Para seguir necesito que completes el formulario de arriba 🙂'
            : 'Elegí una opción tocando un botón 🙂';
    const { text } = renderTemplate(String(data.invalidMessage ?? '') || fallbackMessage, this.varCtx(ctx));

    try {
      await this.sendSessionMessage(ctx, text.substring(0, 4096));
    } catch (error: any) {
      this.logger.warn(`Reprompt falló: ${error?.message}`);
    }

    const waitToken = freshToken();
    const updated = await this.execRepo.casClaim(ctx.execId, FlowExecutionStatus.RUNNING, ctx.token, {
      status: FlowExecutionStatus.WAITING,
      currentNodeId: node.id,
      resumeToken: waitToken,
      waitState: { ...waitState, attempts: waitState.attempts + 1 },
      variables: ctx.variables,
      runningSince: null,
    });
    if (!updated) return;
    // Mismo timeoutAt original: el re-prompt no extiende la espera.
    await this.jobQueue.schedule(
      FLOW_RESUME_JOB,
      { executionId: ctx.execId, token: waitToken, reason: 'timeout' } satisfies FlowResumeJobData,
      waitState.timeoutAt,
    );
    // Sin esto, una respuesta llegada mientras se enviaba la re-pregunta queda
    // huérfana y la ejecución cuelga hasta el timeout.
    await this.rescheduleIfInboundArrived(ctx, waitToken, since);
  }

  // ── Ejecución por tipo de nodo ─────────────────────────────────

  private async executeNode(ctx: RunCtx, node: FlowNode): Promise<NodeResult> {
    const data = node.data as Record<string, any>;

    if (isTrigger(node.type)) return { kind: 'advance', handle: 'out' };

    switch (node.type) {
      case 'action.send_text':
        return this.execSendText(ctx, data);
      case 'action.send_media':
        return this.execSendMedia(ctx, data);
      case 'action.send_location':
        return this.execSendLocation(ctx, data);
      case 'action.send_contact':
        return this.execSendContact(ctx, data);
      case 'action.request_location':
        return this.execRequestLocation(ctx, node, data);
      case 'action.send_flow':
        return this.execSendFlow(ctx, node, data);
      case 'action.react':
        return this.execReact(ctx, data);
      case 'action.typing':
        return this.execTyping(ctx, node, data);
      case 'action.send_cta_url':
        return this.execSendCtaUrl(ctx, data);
      case 'action.set_variable':
        return this.execSetVariable(ctx, data);
      case 'action.emit_event':
        return this.execEmitEvent(ctx, data);
      case 'logic.wait_business_hours':
        return this.execWaitBusinessHours(ctx, data);
      case 'action.send_buttons':
        return this.execSendOptions(ctx, node, data, 'buttons');
      case 'action.send_list':
        return this.execSendOptions(ctx, node, data, 'list');
      case 'action.send_template':
        return this.execSendTemplate(ctx, data);
      case 'action.ask':
        return this.execAsk(ctx, node, data);
      case 'action.ai_reply':
        return this.execAiReply(ctx, data);
      case 'logic.ai_route':
        return this.execAiRoute(ctx, data);
      case 'action.handoff_ai':
        return this.execHandoffAi(ctx, node, data);
      case 'action.handoff_human':
        return this.execHandoffHuman(ctx, data);
      case 'action.assign_agent':
        return this.execAssignAgent(ctx, data);
      case 'action.label':
        return this.execLabel(ctx, data);
      case 'action.update_contact':
        return this.execUpdateContact(ctx, data);
      case 'action.internal_note':
        return this.execInternalNote(ctx, data);
      case 'logic.condition':
        return this.execCondition(ctx, data);
      case 'logic.delay':
        return this.execDelay(data);
      case 'action.http':
        return this.execHttp(ctx, data);
      default:
        return { kind: 'error', message: `Tipo de nodo desconocido: ${node.type}` };
    }
  }

  private async execSendText(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) return windowIssue.policy === 'skip' ? { kind: 'advance', handle: 'out', skipped: true, note: 'Ventana de 24 h cerrada — omitido' } : { kind: 'error', message: 'Ventana de 24 h cerrada' };

    const { text, missing } = renderTemplate(String(data.body ?? ''), this.varCtx(ctx));
    await this.sendSessionMessage(ctx, text.substring(0, 4096), undefined, await this.quotedWamid(ctx, data));
    return { kind: 'advance', handle: 'out', note: missing.length ? `variables sin valor: ${missing.join(', ')}` : undefined };
  }

  /**
   * El último mensaje del cliente. Es a lo único que Meta deja reaccionar
   * (131009 si es propio) y lo que se cita al responder.
   */
  private async lastInboundWamid(ctx: RunCtx): Promise<string | null> {
    const { data } = await this.messageRepo.findByConversationId(ctx.conversation.id, 1, 30);
    // Se ordena por timestamp acá y no se confía en el orden del repositorio:
    // sus dos llamadores históricos lo interpretaban al revés entre sí.
    const inbound = data
      .filter((message) => message.direction === MessageDirection.INBOUND && message.waMessageId)
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
    return inbound[0]?.waMessageId ?? null;
  }

  private async quotedWamid(ctx: RunCtx, data: Record<string, any>): Promise<string | undefined> {
    if (!data.quoteLastInbound) return undefined;
    return (await this.lastInboundWamid(ctx)) ?? undefined;
  }

  private async execSendMedia(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) {
      return windowIssue.policy === 'skip'
        ? { kind: 'advance', handle: 'out', skipped: true, note: 'Ventana de 24 h cerrada — omitido' }
        : { kind: 'error', message: 'Ventana de 24 h cerrada' };
    }

    const varCtx = this.varCtx(ctx);
    const rawCaption = data.caption ? renderTemplate(String(data.caption), varCtx).text.substring(0, 1024) : undefined;

    // Un archivo de la biblioteca se manda por media_id: lo subimos nosotros y
    // no hace falta que sea público. La URL queda para casos externos.
    let mediaId: string | undefined;
    let url: string | undefined;
    let asset: MediaAsset | null = null;
    let messageType = URL_MEDIA_MESSAGE_TYPES[String(data.mediaType ?? 'image')] ?? MessageType.IMAGE;

    if (data.mediaAssetId) {
      asset = await this.assetRepo.findById(String(data.mediaAssetId));
      if (!asset || asset.tenantId !== ctx.tenantId || asset.deletedAt) {
        return { kind: 'error', message: 'El archivo del nodo ya no existe' };
      }
      if (asset.isUnavailable()) {
        return { kind: 'error', message: 'El archivo del nodo ya no está disponible' };
      }
      messageType = FLOW_MEDIA_MESSAGE_TYPES[asset.kind];
      ({ mediaId } = await this.mediaAccess.resolveSendRef(asset, ctx.phone));
    } else {
      url = renderTemplate(String(data.mediaUrl ?? ''), varCtx).text.trim();
      if (!/^https:\/\//i.test(url)) return { kind: 'error', message: 'La URL del archivo debe ser https' };
    }

    const caption = MEDIA_TYPES_WITHOUT_CAPTION.has(messageType) ? undefined : rawCaption;

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: ctx.phone.provider,
      providerConfig: ctx.phone.providerConfig,
      phoneNumberId: ctx.phone.phoneNumberId,
      ...recipientIdentityOf(ctx.contact),
      billing: flowBilling(ctx),
      type: messageType,
      body: caption,
      mediaId,
      mediaUrl: url,
      filename: asset?.filename ?? (data.filename ? String(data.filename) : undefined),
      contextWaMessageId: await this.quotedWamid(ctx, data),
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: ctx.conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType,
      body: caption ?? null,
      mediaUrl: url ?? null,
      mimeType: asset?.mimeType ?? null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: null,
      senderAgentName: ctx.flow.name,
      mediaAssetId: asset?.id ?? null,
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'message.new', message);
    this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
    await this.conversationRepo.update(ctx.conversation.id, { lastMessageAt: new Date() } as any);

    return { kind: 'advance', handle: 'out' };
  }

  /**
   * Guardar valor: cubre los casos "custom" (contadores, códigos, textos
   * compuestos) sin necesidad de ejecutar código del tenant.
   */
  private execSetVariable(ctx: RunCtx, data: Record<string, any>): NodeResult {
    const saveAs = String(data.saveAs ?? '');
    if (!saveAs) return { kind: 'error', message: 'Falta el nombre de la variable' };

    const varCtx = this.varCtx(ctx);
    const mode = String(data.mode ?? 'text');
    const rendered = renderTemplate(String(data.value ?? ''), varCtx).text;

    switch (mode) {
      case 'number': {
        const parsed = parseLatamNumber(rendered);
        if (parsed === null) return { kind: 'error', message: `"${rendered}" no es un número válido` };
        this.setVar(ctx, saveAs, parsed);
        return { kind: 'advance', handle: 'out', note: String(parsed) };
      }
      case 'increment': {
        const step = parseLatamNumber(rendered || '1') ?? 1;
        const current = resolvePath(varCtx as any, `vars.${saveAs}`);
        const base = typeof current === 'number' ? current : (parseLatamNumber(String(current ?? '0')) ?? 0);
        const next = base + step;
        this.setVar(ctx, saveAs, next);
        return { kind: 'advance', handle: 'out', note: String(next) };
      }
      case 'random_code': {
        // Código numérico para verificación (OTP). randomInt es criptográfico:
        // Math.random sería predecible y esto termina autenticando gente.
        const length = Math.min(Math.max(parseInt(String(data.length ?? 6), 10) || 6, 4), 10);
        let code = '';
        for (let i = 0; i < length; i++) code += String(randomInt(0, 10));
        this.setVar(ctx, saveAs, code);
        // El código no va al log de pasos: queda en las variables de la ejecución.
        return { kind: 'advance', handle: 'out', note: `código de ${length} dígitos` };
      }
      case 'text':
      default:
        this.setVar(ctx, saveAs, rendered);
        return { kind: 'advance', handle: 'out', note: rendered.substring(0, 60) };
    }
  }

  /** Tarjeta de contacto: el cliente la guarda en su agenda con un toque. */
  private async execSendContact(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) {
      return windowIssue.policy === 'skip'
        ? { kind: 'advance', handle: 'out', skipped: true, note: 'Ventana de 24 h cerrada — omitido' }
        : { kind: 'error', message: 'Ventana de 24 h cerrada' };
    }

    const varCtx = this.varCtx(ctx);
    const render = (value: unknown) => renderTemplate(String(value ?? ''), varCtx).text.trim();

    const formattedName = render(data.contactName);
    if (!formattedName) return { kind: 'error', message: 'La tarjeta necesita un nombre' };

    const phone = render(data.contactPhone).replace(/[^\d+]/g, '');
    const email = render(data.contactEmail);
    const company = render(data.contactCompany);

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: ctx.phone.provider,
      providerConfig: ctx.phone.providerConfig,
      phoneNumberId: ctx.phone.phoneNumberId,
      ...recipientIdentityOf(ctx.contact),
      billing: flowBilling(ctx),
      type: MessageType.CONTACTS,
      contacts: [
        {
          name: { formatted_name: formattedName },
          ...(phone ? { phones: [{ phone, type: 'CELL' }] } : {}),
          ...(email ? { emails: [{ email, type: 'WORK' }] } : {}),
          ...(company ? { org: { company } } : {}),
        },
      ],
      contextWaMessageId: await this.quotedWamid(ctx, data),
    });

    await this.persistOutbound(ctx, waMessageId, MessageType.CONTACTS, formattedName, null);
    return { kind: 'advance', handle: 'out', note: formattedName };
  }

  /**
   * Pedir la ubicación con el botón nativo. Llegan coordenadas exactas, que es
   * mucho mejor que una dirección escrita a mano para un envío o una visita.
   */
  private async execRequestLocation(ctx: RunCtx, node: FlowNode, data: Record<string, any>): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) {
      return windowIssue.policy === 'skip'
        ? { kind: 'advance', handle: 'timeout', skipped: true, note: 'Ventana de 24 h cerrada — omitido' }
        : { kind: 'error', message: 'Ventana de 24 h cerrada' };
    }

    const { text } = renderTemplate(String(data.body ?? ''), this.varCtx(ctx));
    const body = text.substring(0, 1024);
    const sentAt = new Date();
    await this.sendSessionMessage(ctx, body, { kind: 'location_request', body });

    const timeoutMs = Math.min(durationToMs(data.timeout) ?? DEFAULT_REPLY_TIMEOUT_MS, MAX_WAIT_MS);
    return {
      kind: 'wait',
      sentAt,
      wait: {
        nodeId: node.id,
        kind: 'reply',
        timeoutAt: new Date(Date.now() + timeoutMs),
        waitingSince: new Date(),
        saveAs: typeof data.saveAs === 'string' && data.saveAs ? data.saveAs : null,
        optionMap: null,
        textMap: null,
        attempts: 0,
        validation: null,
      },
    };
  }

  /**
   * Manda un formulario nativo de WhatsApp (Flow) y espera a que el cliente lo
   * complete. La respuesta vuelve en un solo mensaje y **no trae el id del
   * Flow**: se ata por el `flow_token`, que acá es el id de esta ejecución.
   */
  private async execSendFlow(ctx: RunCtx, node: FlowNode, data: Record<string, any>): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) {
      return windowIssue.policy === 'skip'
        ? { kind: 'advance', handle: 'timeout', skipped: true, note: 'Ventana de 24 h cerrada — omitido' }
        : { kind: 'error', message: 'Ventana de 24 h cerrada' };
    }

    const flowId = String(data.flowId ?? '').trim();
    if (!flowId) return { kind: 'error', message: 'El nodo no tiene ningún formulario elegido' };

    const varCtx = this.varCtx(ctx);
    const body = renderTemplate(String(data.body ?? ''), varCtx).text.substring(0, 1024);
    const token = `${ctx.execId}:${node.id}`;
    const sentAt = new Date();

    await this.sendSessionMessage(ctx, body, {
      kind: 'flow',
      body,
      ...(data.footer ? { footer: renderTemplate(String(data.footer), varCtx).text } : {}),
      ...(data.header ? { header: renderTemplate(String(data.header), varCtx).text } : {}),
      flow: {
        id: flowId,
        token,
        cta: String(data.cta ?? 'Abrir formulario').substring(0, 30),
        screen: String(data.screen ?? '') || undefined,
        mode: data.mode === 'draft' ? 'draft' : 'published',
        action: data.hasEndpoint ? 'data_exchange' : 'navigate',
      },
    });

    const timeoutMs = Math.min(durationToMs(data.timeout) ?? DEFAULT_REPLY_TIMEOUT_MS, MAX_WAIT_MS);
    return {
      kind: 'wait',
      sentAt,
      wait: {
        nodeId: node.id,
        kind: 'reply',
        timeoutAt: new Date(Date.now() + timeoutMs),
        waitingSince: new Date(),
        saveAs: typeof data.saveAs === 'string' && data.saveAs ? data.saveAs : null,
        optionMap: null,
        textMap: null,
        attempts: 0,
        validation: null,
      },
    };
  }

  /**
   * Reaccionar al último mensaje del cliente. Meta rechaza reaccionar a los
   * propios (131009), así que si no hay entrante no se intenta.
   */
  private async execReact(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    if (this.checkWindow(ctx, 'error')) return { kind: 'error', message: 'Ventana de 24 h cerrada' };

    const emoji = String(data.emoji ?? '').trim();
    if (!emoji) return { kind: 'error', message: 'Elegí con qué emoji reaccionar' };

    const target = await this.lastInboundWamid(ctx);
    if (!target) {
      return { kind: 'advance', handle: 'out', skipped: true, note: 'El cliente todavía no escribió: no hay a qué reaccionar' };
    }

    await this.messagingApi.sendMessage({
      provider: ctx.phone.provider,
      providerConfig: ctx.phone.providerConfig,
      phoneNumberId: ctx.phone.phoneNumberId,
      ...recipientIdentityOf(ctx.contact),
      billing: flowBilling(ctx),
      type: MessageType.REACTION,
      reaction: { waMessageId: target, emoji },
    });

    // No se persiste como mensaje: en el chat una reacción es un chip sobre la
    // burbuja del cliente, no una burbuja propia.
    return { kind: 'advance', handle: 'out', note: emoji };
  }

  /**
   * "Escribiendo…" y tilde azul sobre el último mensaje del cliente. El
   * indicador dura hasta 25 s o hasta que mandes algo, así que el nodo espera:
   * sin esa espera el siguiente mensaje lo borraría al instante.
   */
  private async execTyping(ctx: RunCtx, node: FlowNode, data: Record<string, any>): Promise<NodeResult> {
    const target = await this.lastInboundWamid(ctx);
    if (!target) {
      return { kind: 'advance', handle: 'out', skipped: true, note: 'El cliente todavía no escribió' };
    }

    try {
      await this.messagingApi.markAsRead({
        provider: ctx.phone.provider,
        providerConfig: ctx.phone.providerConfig,
        phoneNumberId: ctx.phone.phoneNumberId,
        waMessageId: target,
        typing: true,
      });
    } catch (error: any) {
      // Que no se vea el "escribiendo…" no puede tumbar la conversación.
      this.logger.warn(`No se pudo mostrar el indicador de tipeo: ${error?.message}`);
      return { kind: 'advance', handle: 'out', skipped: true, note: 'No se pudo mostrar el indicador' };
    }

    const seconds = Math.min(Math.max(parseInt(String(data.seconds ?? 3), 10) || 3, 1), TYPING_MAX_SECONDS);
    return {
      kind: 'wait',
      sentAt: new Date(),
      wait: {
        nodeId: node.id,
        kind: 'delay',
        timeoutAt: new Date(Date.now() + seconds * 1000),
        waitingSince: new Date(),
        saveAs: null,
        optionMap: null,
        textMap: null,
        attempts: 0,
        validation: null,
      },
    };
  }

  /** Avisar a mis sistemas: publica un evento propio en los webhooks del tenant. */
  private execEmitEvent(ctx: RunCtx, data: Record<string, any>): NodeResult {
    const varCtx = this.varCtx(ctx);
    const name = renderTemplate(String(data.eventName ?? ''), varCtx).text.trim();
    if (!name) return { kind: 'error', message: 'Falta el nombre del evento' };

    const payload: Record<string, unknown> = {};
    for (const field of Array.isArray(data.fields) ? data.fields : []) {
      const key = String(field?.key ?? '').trim();
      if (key) payload[key] = renderTemplate(String(field?.value ?? ''), varCtx).text;
    }

    this.devEvents.emit(ctx.tenantId, DeveloperEventType.FLOW_CUSTOM, {
      name,
      flowId: ctx.flow.id,
      executionId: ctx.execId,
      conversationId: ctx.conversation.id,
      contactId: ctx.contact.id,
      data: payload,
    });
    return { kind: 'advance', handle: 'out', note: name };
  }

  /**
   * Espera hasta la próxima franja hábil. Evita que un delay fijo termine
   * mandando mensajes de madrugada.
   */
  private execWaitBusinessHours(ctx: RunCtx, data: Record<string, any>): NodeResult {
    const schedule = data.schedule ?? { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', timezone: 'America/Montevideo' };
    const nextOpen = this.nextBusinessOpening(schedule);
    if (!nextOpen) return { kind: 'advance', handle: 'out', skipped: true, note: 'ya está en horario' };

    return {
      kind: 'wait',
      sentAt: new Date(),
      wait: {
        nodeId: '',
        kind: 'delay',
        timeoutAt: nextOpen,
        waitingSince: new Date(),
        saveAs: null,
        optionMap: null,
        textMap: null,
        attempts: 0,
        validation: null,
      },
    };
  }

  /** null = ya estamos dentro de la franja. Busca hasta 8 días adelante. */
  private nextBusinessOpening(schedule: Record<string, any>): Date | null {
    const timezone = typeof schedule.timezone === 'string' && schedule.timezone ? schedule.timezone : 'America/Montevideo';
    const days: number[] = Array.isArray(schedule.days) && schedule.days.length > 0 ? schedule.days : [1, 2, 3, 4, 5];
    const from = String(schedule.from ?? '09:00');
    const to = String(schedule.to ?? '18:00');

    const partsAt = (date: Date) => {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
      });
      const parts = fmt.formatToParts(date);
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
      const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
      const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
      return {
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday),
        time: `${hour}:${minute}`,
      };
    };

    const now = new Date();
    const current = partsAt(now);
    const inWindow = from <= to
      ? current.time >= from && current.time < to
      : current.time >= from || current.time < to;
    if (days.includes(current.day) && inWindow) return null;

    // Se avanza de a 15 minutos: evita hacer aritmética de husos a mano
    // (DST incluido) y con 8 días de tope siempre encuentra la apertura.
    const STEP_MS = 15 * 60 * 1000;
    for (let elapsed = STEP_MS; elapsed <= 8 * 86_400_000; elapsed += STEP_MS) {
      const candidate = new Date(now.getTime() + elapsed);
      const at = partsAt(candidate);
      const open = from <= to ? at.time >= from && at.time < to : at.time >= from || at.time < to;
      if (days.includes(at.day) && open) return candidate;
    }
    return new Date(now.getTime() + 86_400_000);
  }

  private async execSendOptions(ctx: RunCtx, node: FlowNode, data: Record<string, any>, kind: 'buttons' | 'list'): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) return windowIssue.policy === 'skip' ? { kind: 'advance', handle: 'timeout', skipped: true, note: 'Ventana de 24 h cerrada — omitido' } : { kind: 'error', message: 'Ventana de 24 h cerrada' };

    const varCtx = this.varCtx(ctx);
    const { text: body } = renderTemplate(String(data.body ?? ''), varCtx);
    // Meta rechaza footers de más de 60 caracteres.
    const renderedFooter = data.footer ? renderTemplate(String(data.footer), varCtx).text : '';
    const footer = renderedFooter ? renderedFooter.substring(0, 60) : undefined;

    const options: Array<{ title: string; description?: string }> =
      kind === 'buttons'
        ? (Array.isArray(data.buttons) ? data.buttons : []).map((b: any) => ({ title: String(b?.title ?? '') }))
        : (Array.isArray(data.rows) ? data.rows : []).map((r: any) => ({ title: String(r?.title ?? ''), description: r?.description ? String(r.description) : undefined }));

    const handlePrefix = kind === 'buttons' ? 'btn' : 'row';
    const optionMap: Record<string, string> = {};
    const textMap: Record<string, string> = {};
    options.forEach((option, idx) => {
      optionMap[`fl:${node.id}:${idx}`] = `${handlePrefix}:${idx}`;
      // Primer título gana: dos opciones que normalizan igual ("Sí"/"SI") no
      // deben pisarse, o el texto tipeado iría a la rama equivocada.
      const key = normalizeText(option.title);
      if (key && !(key in textMap)) textMap[key] = `${handlePrefix}:${idx}`;
    });

    const sentAt = new Date();

    const interactive: InteractiveSendPayload =
      kind === 'buttons'
        ? {
            kind: 'buttons',
            body: body.substring(0, 1024),
            footer,
            buttons: options.map((option, idx) => ({ id: `fl:${node.id}:${idx}`, title: option.title.substring(0, 20) })),
          }
        : {
            kind: 'list',
            body: body.substring(0, 4096),
            footer,
            buttonText: String(data.buttonText ?? 'Ver opciones').substring(0, 20),
            rows: options.map((option, idx) => ({
              id: `fl:${node.id}:${idx}`,
              title: option.title.substring(0, 24),
              description: option.description?.substring(0, 72),
            })),
          };
    await this.sendSessionMessage(ctx, body, interactive);

    const timeoutMs = Math.min(durationToMs(data.timeout) ?? DEFAULT_REPLY_TIMEOUT_MS, MAX_WAIT_MS);
    return {
      kind: 'wait',
      sentAt,
      wait: {
        nodeId: node.id,
        kind: 'reply',
        timeoutAt: new Date(Date.now() + timeoutMs),
        waitingSince: new Date(),
        saveAs: typeof data.saveAs === 'string' && data.saveAs ? data.saveAs : null,
        // Siempre poblado: además del tap, el mapa define el orden de las
        // opciones para cuando el cliente responde con el ordinal o el título.
        optionMap,
        textMap,
        attempts: 0,
        validation: null,
      },
    };
  }

  private async execSendTemplate(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const template = await this.templateRepo.findById(String(data.templateId ?? ''));
    if (!template || template.tenantId !== ctx.tenantId) return { kind: 'error', message: 'Plantilla inexistente' };
    if (template.status !== TemplateStatus.APPROVED) return { kind: 'error', message: 'La plantilla no está aprobada' };
    // La plantilla vive en una WABA concreta: mandarla por otra línea la rechaza Meta.
    if (template.phoneNumberId !== ctx.phone.id) {
      return { kind: 'error', message: 'La plantilla pertenece a otro número de WhatsApp' };
    }
    // Meta rechaza las plantillas de autenticación dirigidas a un BSUID (131062).
    if (isBsuidOnly(recipientIdentityOf(ctx.contact)) && templateRequiresPhone(template.category)) {
      return { kind: 'error', message: 'Las plantillas de autenticación necesitan un teléfono, y este contacto solo compartió su usuario de WhatsApp' };
    }

    const varCtx = this.varCtx(ctx);
    const variables: Record<string, string> = {};
    const mapping: Record<string, { source?: string; value?: string }> = data.variables ?? {};
    for (const [placeholder, def] of Object.entries(mapping)) {
      const source = def?.source ?? 'static';
      const rawValue = String(def?.value ?? '');
      if (source === 'contact_field') {
        variables[placeholder] = String(resolvePath(varCtx as any, `contact.${rawValue}`) ?? '');
      } else if (source === 'flow_var') {
        variables[placeholder] = String(resolvePath(varCtx as any, rawValue) ?? '');
      } else {
        variables[placeholder] = renderTemplate(rawValue, varCtx).text;
      }
    }

    const built = buildTemplatePayload(template.components, variables);
    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: ctx.phone.provider,
      providerConfig: ctx.phone.providerConfig,
      phoneNumberId: ctx.phone.phoneNumberId,
      ...recipientIdentityOf(ctx.contact),
      type: 'template',
      template: {
        name: template.name,
        language: template.language,
        components: built.components,
      },
      // La categoría se congela acá: Meta la puede cambiar después y entonces
      // leerla de la plantilla daría una tarifa que no es la que se cobró.
      billing: flowBilling(ctx, { templateId: template.id, templateCategory: template.category }),
    });
    await this.persistOutbound(ctx, waMessageId, MessageType.TEMPLATE, built.renderedBody, null);
    return { kind: 'advance', handle: 'out' };
  }

  private async execAsk(ctx: RunCtx, node: FlowNode, data: Record<string, any>): Promise<NodeResult> {
    const windowIssue = this.checkWindow(ctx, data.windowPolicy);
    if (windowIssue) return windowIssue.policy === 'skip' ? { kind: 'advance', handle: 'timeout', skipped: true, note: 'Ventana de 24 h cerrada — omitido' } : { kind: 'error', message: 'Ventana de 24 h cerrada' };

    const { text } = renderTemplate(String(data.body ?? ''), this.varCtx(ctx));
    const sentAt = new Date();
    await this.sendSessionMessage(ctx, text.substring(0, 4096));

    const timeoutMs = Math.min(durationToMs(data.timeout) ?? DEFAULT_REPLY_TIMEOUT_MS, MAX_WAIT_MS);
    return {
      kind: 'wait',
      sentAt,
      wait: {
        nodeId: node.id,
        kind: 'reply',
        timeoutAt: new Date(Date.now() + timeoutMs),
        waitingSince: new Date(),
        saveAs: typeof data.saveAs === 'string' && data.saveAs ? data.saveAs : null,
        optionMap: null,
        textMap: null,
        attempts: 0,
        validation: typeof data.validation === 'string' ? data.validation : 'texto',
      },
    };
  }

  private async execAiReply(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    if (this.checkWindow(ctx, 'error')) return { kind: 'error', message: 'Ventana de 24 h cerrada' };

    // El negocio sale de la cuenta; la conducta, de este nodo.
    const tenant = await this.tenantRepo.findById(ctx.tenantId);
    if (!tenant) return { kind: 'error', message: 'No se pudo leer la cuenta' };
    const config = resolveAiPersona(tenant, data);

    // Tope diario de la cuenta.
    if (tenant.aiRateLimits.maxMessagesPerDay > 0) {
      const usage = await this.usageRepo.getUsage(ctx.tenantId, today());
      if (usage && usage.messageCount >= tenant.aiRateLimits.maxMessagesPerDay) {
        return { kind: 'error', message: 'La cuenta alcanzó su límite diario de mensajes de IA' };
      }
    }

    const { data: history } = await this.messageRepo.findByConversationId(
      ctx.conversation.id,
      1,
      config.contextConfig.maxHistoryMessages,
    );

    // Pre-check de derivación del agente sobre los últimos mensajes entrantes.
    const recentInbound = history
      .filter((m) => m.direction === MessageDirection.INBOUND)
      .slice(-5)
      .map((m) => m.body ?? '')
      .join(' ');
    const preCheck = this.handoffDetection.shouldHandoff(recentInbound, config.handoffRules, 0);
    if (preCheck.trigger) {
      return { kind: 'advance', handle: 'handoff', note: preCheck.reason };
    }

    const tenantLabels = await this.labelRepo.findByTenantId(ctx.tenantId);
    const instructions = typeof data.instructions === 'string' && data.instructions.trim()
      ? renderTemplate(data.instructions, this.varCtx(ctx)).text
      : undefined;

    const systemPrompt = buildAgentSystemPrompt({
      config,
      contact: config.contextConfig.includeContactInfo ? ctx.contact : null,
      conversationSummary: ctx.conversation.summary ?? null,
      labels: tenantLabels.map((l) => l.name),
      extraInstructions: instructions,
    });

    const result = await this.aiCompletion.complete({
      systemPrompt,
      messages: buildChatHistory(history),
    });

    const content = stripTimestampPrefixes(result.content ?? '');
    if (!content.trim()) return { kind: 'error', message: 'El asistente no produjo respuesta' };

    const bubbles = config.multiMessage?.enabled
      ? parseMultiMessageResponse(content, config.multiMessage.maxBubbles, this.logger)
      : [content];

    await this.usageRepo.incrementUsage(ctx.tenantId, today(), bubbles.length, result.tokensUsed.total);

    await sendBubbles({
      messagingApi: this.messagingApi,
      messageRepo: this.messageRepo,
      gateway: this.gateway,
      phone: ctx.phone,
      recipient: recipientIdentityOf(ctx.contact),
      conversationId: ctx.conversation.id,
      senderAgentId: null,
      senderAgentName: config.name,
      senderKind: 'ai',
      bubbles,
      interBubbleDelayMs: config.multiMessage?.interBubbleDelayMs ?? 1200,
      replyToWaMessageId: lastInboundOf(history)?.waMessageId ?? null,
      billing: flowBilling(ctx, { senderKind: 'ai' }),
    });

    await this.conversationRepo.update(ctx.conversation.id, { lastMessageAt: new Date() } as any);
    this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
    return { kind: 'advance', handle: 'out' };
  }

  private async execAiRoute(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const options: Array<{ key: string; label: string }> = Array.isArray(data.options) ? data.options : [];
    if (options.length < 2) return { kind: 'error', message: 'El clasificador necesita al menos 2 opciones' };

    const { data: history } = await this.messageRepo.findByConversationId(ctx.conversation.id, 1, 5);
    const question = typeof data.question === 'string' && data.question.trim()
      ? data.question
      : 'Classify the intent of the customer based on the recent conversation.';

    const systemPrompt = [
      'You are an intent classifier for a WhatsApp business conversation.',
      question,
      'Reply with EXACTLY one of the following keys (a single word, no punctuation, no explanation):',
      ...options.map((o) => `- ${o.key}: ${o.label}`),
    ].join('\n');

    const result = await this.aiCompletion.complete({
      systemPrompt,
      messages: buildChatHistory(history),
      maxTokens: 32,
    });

    await this.usageRepo.incrementUsage(ctx.tenantId, today(), 0, result.tokensUsed.total);

    const raw = normalizeText(stripTimestampPrefixes(result.content ?? ''));
    const exact = options.find((o) => normalizeText(o.key) === raw);
    const partial = exact ?? options.find((o) => raw.includes(normalizeText(o.key)));
    if (partial) return { kind: 'advance', handle: `opt:${partial.key}`, note: partial.key };
    return { kind: 'advance', handle: 'fallback', note: `sin clasificar: "${raw.slice(0, 60)}"` };
  }

  private async execHandoffAi(ctx: RunCtx, node: FlowNode, data: Record<string, any>): Promise<NodeResult> {
    const tenant = await this.tenantRepo.findById(ctx.tenantId);
    if (!tenant) return { kind: 'error', message: 'No se pudo leer la cuenta' };
    const persona = resolveAiPersona(tenant, data);

    // El bot no se "asigna": queda apuntado en el piloto de la conversación.
    // El puntero va a la versión publicada — inmutable — así que editar el
    // flujo no le cambia la personalidad a un chat ya en curso. `agentId` se
    // libera porque a partir de acá contesta el bot, no una persona.
    if (ctx.conversation.agentId) {
      await this.agentRepo.incrementActiveCount(ctx.conversation.agentId, -1);
    }
    await this.conversationRepo.update(ctx.conversation.id, {
      agentId: null,
      status: ConversationStatus.ACTIVE,
      // Latch del debounce: sin esto ProcessAiResponseUseCase descarta el job
      // por su chequeo de idempotencia (multiMessage viene activo por defecto).
      pendingAiSince: new Date(),
      autopilot: {
        enabled: true,
        pausedReason: null,
        pausedAt: null,
        aiNode: { flowId: ctx.flow.id, flowVersionId: ctx.version.id, nodeId: node.id },
      },
    } as any);

    const event = await this.eventRepo.create({
      conversationId: ctx.conversation.id,
      tenantId: ctx.tenantId,
      type: ConversationEventType.ASSIGNED,
      performedBy: null,
      data: { agentName: persona.name, via: 'flow', flowName: ctx.flow.name },
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
    this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });

    // El job se encola en afterFinish, ya cerrada la ejecución: mientras siga
    // viva, el guard de ProcessAiResponseUseCase lo descartaría sin reintento.
    return { kind: 'end', endReason: 'delegated_ai', note: persona.name, delegateToAiNodeId: node.id };
  }

  private async execHandoffHuman(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    if (typeof data.note === 'string' && data.note.trim()) {
      const { text } = renderTemplate(data.note, this.varCtx(ctx));
      await this.createFlowNote(ctx, text);
    }
    // Si el flujo dejó la conversación asignada (p. ej. al bot), liberarla primero.
    if (ctx.conversation.agentId) {
      await this.agentRepo.incrementActiveCount(ctx.conversation.agentId, -1);
      await this.conversationRepo.update(ctx.conversation.id, { agentId: null, status: ConversationStatus.UNASSIGNED } as any);
    }
    const agent = await this.autoAssign.execute(ctx.conversation.id);
    return { kind: 'end', endReason: 'handoff', note: agent ? agent.name : 'sin agentes disponibles' };
  }

  private async execAssignAgent(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    if (data.mode === 'specific') {
      const agentId = String(data.agentId ?? '');
      const agent = await this.agentRepo.findById(agentId);
      if (!agent || agent.tenantId !== ctx.tenantId || agent.type !== AgentType.HUMAN) {
        return { kind: 'error', message: 'El agente elegido no está disponible' };
      }
      if (ctx.conversation.agentId && ctx.conversation.agentId !== agent.id) {
        await this.agentRepo.incrementActiveCount(ctx.conversation.agentId, -1);
      }
      if (ctx.conversation.agentId !== agent.id) {
        await this.agentRepo.incrementActiveCount(agent.id, 1);
      }
      await this.conversationRepo.update(ctx.conversation.id, { agentId: agent.id, status: ConversationStatus.ACTIVE } as any);
      const event = await this.eventRepo.create({
        conversationId: ctx.conversation.id,
        tenantId: ctx.tenantId,
        type: ConversationEventType.ASSIGNED,
        performedBy: null,
        data: { agentName: agent.name, via: 'flow', flowName: ctx.flow.name },
      });
      this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
      this.gateway.emitToAgent(agent.id, 'conversation.new', { conversationId: ctx.conversation.id });
      this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
      ctx.conversation = (await this.conversationRepo.findById(ctx.conversation.id)) ?? ctx.conversation;
      return { kind: 'advance', handle: 'out', note: agent.name };
    }

    if (data.mode === 'round_robin') {
      const assigned = await this.assignRoundRobin(ctx);
      ctx.conversation = (await this.conversationRepo.findById(ctx.conversation.id)) ?? ctx.conversation;
      if (!assigned) return { kind: 'advance', handle: 'unassigned' };
      return { kind: 'advance', handle: 'out', note: assigned };
    }

    const agent = await this.autoAssign.execute(ctx.conversation.id);
    ctx.conversation = (await this.conversationRepo.findById(ctx.conversation.id)) ?? ctx.conversation;
    if (!agent) return { kind: 'advance', handle: 'unassigned' };
    return { kind: 'advance', handle: 'out', note: agent.name };
  }

  /**
   * Round-robin real (turnos rotativos) sobre los agentes humanos disponibles
   * con acceso a la línea. A diferencia de "menos ocupado", reparte parejo aunque
   * las conversaciones se cierren a distinto ritmo. El puntero se guarda por
   * flujo en `Flow.stats.started`, que ya se incrementa una vez por ejecución:
   * así el turno avanza sin agregar estado nuevo.
   */
  private async assignRoundRobin(ctx: RunCtx): Promise<string | null> {
    const access = await this.accessRepo.findByPhoneNumberId(ctx.conversation.phoneNumberId);
    const agents = (await Promise.all(access.map((a) => this.agentRepo.findById(a.agentId))))
      .filter((a): a is NonNullable<typeof a> => !!a && a.type === AgentType.HUMAN && a.status === AgentStatus.AVAILABLE)
      .sort((a, b) => a.id.localeCompare(b.id)); // orden estable entre ejecuciones
    if (agents.length === 0) return null;

    const flow = await this.flowRepo.findById(ctx.flow.id);
    const turn = (flow?.stats.started ?? 1) - 1; // la ejecución actual ya sumó
    const agent = agents[((turn % agents.length) + agents.length) % agents.length];

    if (ctx.conversation.agentId && ctx.conversation.agentId !== agent.id) {
      await this.agentRepo.incrementActiveCount(ctx.conversation.agentId, -1);
    }
    if (ctx.conversation.agentId !== agent.id) {
      await this.agentRepo.incrementActiveCount(agent.id, 1);
    }
    await this.conversationRepo.update(ctx.conversation.id, {
      agentId: agent.id,
      status: ConversationStatus.ACTIVE,
    } as any);

    const event = await this.eventRepo.create({
      conversationId: ctx.conversation.id,
      tenantId: ctx.tenantId,
      type: ConversationEventType.ASSIGNED,
      performedBy: null,
      data: { agentName: agent.name, via: 'flow', flowName: ctx.flow.name, strategy: 'round_robin' },
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
    this.gateway.emitToAgent(agent.id, 'conversation.new', { conversationId: ctx.conversation.id });
    this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
    return agent.name;
  }

  private async execLabel(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const label = await this.labelRepo.findById(String(data.labelId ?? ''));
    if (!label || label.tenantId !== ctx.tenantId) return { kind: 'error', message: 'Etiqueta inexistente' };

    const existing = await this.convLabelRepo.findByConversationId(ctx.conversation.id);
    const already = existing.some((cl) => cl.labelId === label.id);

    if (data.action === 'remove') {
      if (already) {
        await this.convLabelRepo.delete(ctx.conversation.id, label.id);
        const event = await this.eventRepo.create({
          conversationId: ctx.conversation.id,
          tenantId: ctx.tenantId,
          type: ConversationEventType.LABEL_REMOVED,
          performedBy: null,
          data: { agentName: `Automatización: ${ctx.flow.name}`, labelName: label.name, labelColor: label.color },
        });
        this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
        this.gateway.emitToConversation(ctx.conversation.id, 'label.removed', {
          conversationId: ctx.conversation.id,
          labelId: label.id,
        });
        this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
      }
      return { kind: 'advance', handle: 'out', note: label.name };
    }

    if (!already) {
      await this.convLabelRepo.create({
        conversationId: ctx.conversation.id,
        tenantId: ctx.tenantId,
        labelId: label.id,
        assignedBy: ctx.flow.createdByAgentId,
      });
      const event = await this.eventRepo.create({
        conversationId: ctx.conversation.id,
        tenantId: ctx.tenantId,
        type: ConversationEventType.LABEL_ADDED,
        performedBy: null,
        data: { agentName: `Automatización: ${ctx.flow.name}`, labelName: label.name, labelColor: label.color },
      });
      this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
      this.gateway.emitToConversation(ctx.conversation.id, 'label.assigned', {
        conversationId: ctx.conversation.id,
        label: { id: label.id, name: label.name, color: label.color },
      });
      this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
    }
    return { kind: 'advance', handle: 'out', note: label.name };
  }

  private async execUpdateContact(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const fields: Array<{ field?: string; value?: string }> = Array.isArray(data.fields) ? data.fields : [];
    const varCtx = this.varCtx(ctx);
    const patch: Record<string, unknown> = {};
    let customFields: Record<string, string> | undefined;
    const applied: Record<string, string> = {};

    for (const entry of fields) {
      const field = entry?.field ?? '';
      const value = renderTemplate(String(entry?.value ?? ''), varCtx).text;
      if (field === 'name' || field === 'email' || field === 'company') {
        patch[field] = value;
        applied[field] = value;
      } else if (field === 'notes') {
        const current = ctx.contact.notes ? `${ctx.contact.notes}\n` : '';
        patch.notes = `${current}${value}`;
        applied.notes = value;
      } else if (field.startsWith('custom.')) {
        const key = field.slice('custom.'.length);
        customFields = customFields ?? { ...(ctx.contact.customFields ?? {}) };
        customFields[key] = value;
        applied[field] = value;
      }
    }
    if (customFields) patch.customFields = customFields;
    if (Object.keys(patch).length === 0) return { kind: 'advance', handle: 'out', skipped: true };

    const updated = await this.contactRepo.update(ctx.contact.id, patch);
    if (updated) ctx.contact = updated;

    const event = await this.eventRepo.create({
      conversationId: ctx.conversation.id,
      tenantId: ctx.tenantId,
      type: ConversationEventType.CONTACT_UPDATED,
      performedBy: null,
      data: { agentName: `Automatización: ${ctx.flow.name}`, fields: applied },
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
    this.gateway.emitToConversation(ctx.conversation.id, 'contact.updated', {
      contactId: ctx.contact.id,
      fields: applied,
    });
    return { kind: 'advance', handle: 'out' };
  }

  private async execInternalNote(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const { text } = renderTemplate(String(data.body ?? ''), this.varCtx(ctx));
    if (text.trim()) await this.createFlowNote(ctx, text);
    return { kind: 'advance', handle: 'out' };
  }

  private execCondition(ctx: RunCtx, data: Record<string, any>): NodeResult {
    const rules: Array<Record<string, any>> = Array.isArray(data.rules) ? data.rules : [];
    const combinator: 'and' | 'or' = data.logic === 'or' ? 'or' : 'and';
    const varCtx = this.varCtx(ctx);

    const evaluate = (rule: Record<string, any>): boolean => {
      const op = String(rule.op ?? 'equals');
      if (op === 'in_schedule') return this.evalSchedule(rule.schedule);

      const leftRaw = resolvePath(varCtx as any, String(rule.left ?? ''));
      const left = leftRaw === undefined || leftRaw === null ? '' : String(leftRaw);
      const right = renderTemplate(String(rule.value ?? ''), varCtx).text;
      const leftNorm = normalizeText(left);
      const rightNorm = normalizeText(right);

      switch (op) {
        case 'equals': return leftNorm === rightNorm;
        case 'not_equals': return leftNorm !== rightNorm;
        case 'contains': return leftNorm.includes(rightNorm);
        case 'not_contains': return !leftNorm.includes(rightNorm);
        case 'starts_with': return leftNorm.startsWith(rightNorm);
        case 'gt': return parseFloat(left.replace(',', '.')) > parseFloat(right.replace(',', '.'));
        case 'lt': return parseFloat(left.replace(',', '.')) < parseFloat(right.replace(',', '.'));
        case 'exists': return leftRaw !== undefined && leftRaw !== null && left !== '';
        case 'not_exists': return leftRaw === undefined || leftRaw === null || left === '';
        default: return false;
      }
    };

    const passed = combinator === 'and' ? rules.every(evaluate) : rules.some(evaluate);
    return { kind: 'advance', handle: passed ? 'yes' : 'no' };
  }

  private evalSchedule(schedule: Record<string, any> | undefined): boolean {
    if (!schedule) return false;
    const timezone = typeof schedule.timezone === 'string' && schedule.timezone ? schedule.timezone : 'America/Montevideo';
    const days: number[] = Array.isArray(schedule.days) ? schedule.days : [];
    const from = String(schedule.from ?? '00:00');
    const to = String(schedule.to ?? '23:59');

    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    const parts = fmt.formatToParts(now);
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort);
    const current = `${hour}:${minute}`;

    if (days.length > 0 && !days.includes(dayIndex)) return false;
    if (from <= to) return current >= from && current < to;
    // Franja que cruza la medianoche (22:00–06:00)
    return current >= from || current < to;
  }

  private execDelay(data: Record<string, any>): NodeResult {
    const ms = Math.min(durationToMs(data.duration) ?? 60_000, MAX_WAIT_MS);
    return {
      kind: 'wait',
      sentAt: new Date(),
      wait: {
        nodeId: '',
        kind: 'delay',
        timeoutAt: new Date(Date.now() + ms),
        waitingSince: new Date(),
        saveAs: null,
        optionMap: null,
        textMap: null,
        attempts: 0,
        validation: null,
      },
    };
  }

  private async execHttp(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const varCtx = this.varCtx(ctx);
    const url = renderTemplate(String(data.url ?? ''), varCtx).text;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    for (const header of Array.isArray(data.headers) ? data.headers : []) {
      if (header?.name) headers[String(header.name)] = renderTemplate(String(header.value ?? ''), varCtx).text;
    }

    if (data.connectionId) {
      const connection = await this.connectionRepo.findById(String(data.connectionId));
      if (!connection || connection.tenantId !== ctx.tenantId) {
        return { kind: 'error', message: 'La conexión configurada no existe' };
      }
      headers[connection.headerName] = this.secrets.decrypt(connection.secretEncrypted);
    }

    let body: string | undefined;
    if (data.bodyMode === 'json' && typeof data.body === 'string' && data.body.trim()) {
      body = renderJsonTemplate(data.body, varCtx).text;
    }

    const method = String(data.method ?? 'GET') as any;
    const attempts = data.retryOnFailure === true ? 3 : 1;
    let lastError = '';

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await this.http.request({ method, url, headers, body, timeoutMs: 10_000 });
        if (typeof data.saveAs === 'string' && data.saveAs) {
          this.setVar(ctx, data.saveAs, { status: response.status, body: response.body });
        }
        if (response.status >= 200 && response.status < 300) {
          return { kind: 'advance', handle: 'success', note: `HTTP ${response.status}` };
        }
        if (response.status < 500 || attempt === attempts) {
          return { kind: 'advance', handle: 'error', isError: true, note: `HTTP ${response.status}` };
        }
        lastError = `HTTP ${response.status}`;
      } catch (error: any) {
        lastError = error?.message ?? 'error de red';
        if (attempt === attempts) {
          return { kind: 'advance', handle: 'error', isError: true, note: lastError };
        }
      }
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
    return { kind: 'advance', handle: 'error', isError: true, note: lastError };
  }

  // ── Helpers de contexto y efectos ──────────────────────────────

  private async loadCtx(exec: FlowExecution): Promise<RunCtx | null> {
    const [flow, version, conversation, contact, phone] = await Promise.all([
      this.flowRepo.findById(exec.flowId),
      this.versionRepo.findById(exec.flowVersionId),
      this.conversationRepo.findById(exec.conversationId),
      this.contactRepo.findById(exec.contactId),
      this.phoneRepo.findById(exec.phoneNumberId),
    ]);

    if (!flow || !version || !conversation || !contact || !phone || phone.status !== 'active') {
      const failed = await this.execRepo.casClaim(exec.id, FlowExecutionStatus.RUNNING, exec.resumeToken, {
        status: FlowExecutionStatus.FAILED,
        endReason: 'context_missing',
        error: { nodeId: exec.currentNodeId ?? '', message: 'Contexto incompleto (flujo/conversación/línea inexistente o inactiva)' },
        runningSince: null,
        waitState: null,
        endedAt: new Date(),
        resumeToken: freshToken(),
      });
      if (failed) await this.afterFinish(failed, FlowExecutionStatus.FAILED, 'context_missing');
      return null;
    }

    return {
      execId: exec.id,
      tenantId: exec.tenantId,
      token: exec.resumeToken,
      flow,
      version,
      conversation,
      contact,
      phone,
      variables: exec.variables ?? {},
    };
  }

  private varCtx(ctx: RunCtx): FlowVariableContext {
    return {
      contact: {
        name: ctx.contact.name,
        phone: ctx.contact.phone,
        email: ctx.contact.email,
        company: ctx.contact.company,
        notes: ctx.contact.notes,
        customFields: ctx.contact.customFields ?? {},
      },
      message: (ctx.variables.message as Record<string, unknown>) ?? null,
      vars: (ctx.variables.vars as Record<string, unknown>) ?? {},
      webhook: (ctx.variables.webhook as Record<string, unknown>) ?? null,
      flow: { name: ctx.flow.name },
      sender: (ctx.variables.sender as Record<string, unknown>) ?? null,
      ad: adVariables(ctx.conversation.attribution),
    };
  }

  private setVar(ctx: RunCtx, key: string, value: unknown): void {
    const vars = { ...((ctx.variables.vars as Record<string, unknown>) ?? {}) };
    vars[key] = value;
    ctx.variables = { ...ctx.variables, vars };
    // Cap defensivo de 32 KB sobre el JSON de variables.
    const serialized = JSON.stringify(ctx.variables);
    if (serialized.length > 32 * 1024) {
      vars[key] = typeof value === 'string' ? value.slice(0, 1024) : '[valor truncado]';
      ctx.variables = { ...ctx.variables, vars };
    }
  }

  private checkWindow(ctx: RunCtx, policy: unknown): { policy: 'skip' | 'error' } | null {
    const open = Date.now() - ctx.conversation.lastInboundAt.getTime() < WINDOW_MS;
    if (open) return null;
    return { policy: policy === 'skip' ? 'skip' : 'error' };
  }

  /**
   * Manda una ubicación fija: la del negocio, la del punto de retiro. Las
   * coordenadas admiten variables, así que un flujo puede mandar la sucursal
   * que eligió el cliente.
   */
  private async execSendLocation(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const varCtx = this.varCtx(ctx);
    const latitude = Number(renderTemplate(String(data.latitude ?? ''), varCtx).text.trim());
    const longitude = Number(renderTemplate(String(data.longitude ?? ''), varCtx).text.trim());

    // Meta rechaza una ubicación a medias y se pierde el mensaje entero.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { kind: 'error', message: 'La ubicación no tiene coordenadas válidas' };
    }

    const name = renderTemplate(String(data.name ?? ''), varCtx).text.trim();
    const address = renderTemplate(String(data.address ?? ''), varCtx).text.trim();
    const location = { latitude, longitude, name: name || undefined, address: address || undefined };

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: ctx.phone.provider,
      providerConfig: ctx.phone.providerConfig,
      phoneNumberId: ctx.phone.phoneNumberId,
      ...recipientIdentityOf(ctx.contact),
      type: MessageType.LOCATION,
      location,
      billing: flowBilling(ctx),
    });

    await this.persistOutbound(ctx, waMessageId, MessageType.LOCATION, [name, address].filter(Boolean).join(': '), null, toMessageLocation(location));
    return { kind: 'advance', handle: 'out' };
  }

  /**
   * Botón con link **sin plantilla**. Sólo vale dentro de la ventana de 24 h,
   * que es justamente donde una plantilla sería un desperdicio.
   */
  private async execSendCtaUrl(ctx: RunCtx, data: Record<string, any>): Promise<NodeResult> {
    const varCtx = this.varCtx(ctx);
    const body = renderTemplate(String(data.body ?? ''), varCtx).text.trim();
    const url = renderTemplate(String(data.url ?? ''), varCtx).text.trim();

    if (!body) return { kind: 'error', message: 'El mensaje del botón está vacío' };
    if (!/^https?:\/\//i.test(url)) return { kind: 'error', message: 'El link del botón no es una URL válida' };

    const interactive: InteractiveSendPayload = {
      kind: 'cta_url',
      body: body.substring(0, 1024),
      footer: renderTemplate(String(data.footer ?? ''), varCtx).text.trim() || undefined,
      buttonText: (renderTemplate(String(data.buttonText ?? ''), varCtx).text.trim() || 'Abrir').substring(0, 20),
      url,
    };

    await this.sendSessionMessage(ctx, body, interactive);
    return { kind: 'advance', handle: 'out' };
  }

  private async sendSessionMessage(
    ctx: RunCtx,
    body: string,
    interactive?: InteractiveSendPayload,
    contextWaMessageId?: string,
  ): Promise<void> {
    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: ctx.phone.provider,
      providerConfig: ctx.phone.providerConfig,
      phoneNumberId: ctx.phone.phoneNumberId,
      ...recipientIdentityOf(ctx.contact),
      type: interactive ? 'interactive' : 'text',
      body,
      interactive,
      contextWaMessageId,
      billing: flowBilling(ctx),
    });
    await this.persistOutbound(
      ctx,
      waMessageId,
      interactive ? MessageType.INTERACTIVE : MessageType.TEXT,
      body,
      interactive ? ({ ...interactive } as Record<string, unknown>) : null,
    );
  }

  private async persistOutbound(
    ctx: RunCtx,
    waMessageId: string,
    messageType: MessageType,
    body: string,
    interactivePayload: Record<string, unknown> | null,
    location: MessageLocation | null = null,
  ): Promise<void> {
    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: ctx.conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType,
      body,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: null,
      senderAgentName: ctx.flow.name,
      interactivePayload,
      location,
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'message.new', message);
    this.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversation.id });
    await this.conversationRepo.update(ctx.conversation.id, { lastMessageAt: new Date() } as any);
  }

  private async createFlowNote(ctx: RunCtx, body: string): Promise<void> {
    const note = await this.noteRepo.create({
      conversationId: ctx.conversation.id,
      tenantId: ctx.tenantId,
      authorId: ctx.flow.createdByAgentId,
      authorName: `Automatización: ${ctx.flow.name}`,
      body: body.substring(0, 4096),
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'note.new', note);
    const event = await this.eventRepo.create({
      conversationId: ctx.conversation.id,
      tenantId: ctx.tenantId,
      type: ConversationEventType.NOTE_ADDED,
      performedBy: null,
      data: { agentName: `Automatización: ${ctx.flow.name}` },
    });
    this.gateway.emitToConversation(ctx.conversation.id, 'conversation.event', event);
  }

  private async applySaveToContact(ctx: RunCtx, node: FlowNode, value: string): Promise<void> {
    const saveTo = (node.data as any)?.saveToContact;
    if (typeof saveTo !== 'string' || !saveTo) return;
    const patch: Record<string, unknown> = {};
    if (saveTo === 'name' || saveTo === 'email' || saveTo === 'company') {
      patch[saveTo] = value;
    } else if (saveTo.startsWith('custom.')) {
      patch.customFields = { ...(ctx.contact.customFields ?? {}), [saveTo.slice('custom.'.length)]: value };
    } else {
      return;
    }
    const updated = await this.contactRepo.update(ctx.contact.id, patch);
    if (updated) ctx.contact = updated;
    this.gateway.emitToConversation(ctx.conversation.id, 'contact.updated', {
      contactId: ctx.contact.id,
      fields: { [saveTo]: value },
    });
  }

  private optionTitle(node: FlowNode, handle: string): string | null {
    const data = node.data as Record<string, any>;
    const idx = parseInt(handle.split(':')[1] ?? '', 10);
    if (Number.isNaN(idx)) return null;
    if (node.type === 'action.send_buttons') return data.buttons?.[idx]?.title ?? null;
    if (node.type === 'action.send_list') return data.rows?.[idx]?.title ?? null;
    return null;
  }

  private stepLog(node: FlowNode, status: 'ok' | 'error' | 'skipped', handle: string | null, note: string | null, startMs: number): FlowStepLog {
    return {
      nodeId: node.id,
      type: node.type,
      status,
      handle,
      at: new Date(),
      ms: Date.now() - startMs,
      note: note ? note.substring(0, 300) : null,
    };
  }

  private bumpStat(ctx: RunCtx, nodeId: string, delta: { entered?: number; errors?: number; outcomeHandle?: string }): void {
    this.statRepo
      .increment(ctx.tenantId, ctx.flow.id, ctx.version.id, nodeId, today(), delta)
      .catch((error) => this.logger.warn(`No se pudo registrar stats de nodo: ${error?.message}`));
  }

  private async finish(
    ctx: RunCtx,
    status: FlowExecutionStatus.COMPLETED | FlowExecutionStatus.FAILED,
    endReason: string,
    error: { nodeId: string; message: string } | null,
    finalStep?: FlowStepLog,
    delegateToAiNodeId?: string,
  ): Promise<void> {
    const patch = {
      status,
      endReason,
      error,
      waitState: null,
      runningSince: null,
      endedAt: new Date(),
      variables: ctx.variables,
      resumeToken: freshToken(),
    };

    const updated = finalStep
      ? await this.execRepo.advanceCursor(ctx.execId, ctx.token, patch, finalStep)
      : await this.execRepo.casClaim(ctx.execId, FlowExecutionStatus.RUNNING, ctx.token, patch);
    if (!updated) return;

    await this.afterFinish(updated, status, endReason, delegateToAiNodeId);
  }

  /** Efectos post-final: stats, evento de timeline, WS y fallback humano */
  private async afterFinish(
    exec: FlowExecution,
    status: FlowExecutionStatus,
    endReason: string,
    delegateToAiNodeId?: string,
  ): Promise<void> {
    const failed = status === FlowExecutionStatus.FAILED;
    await this.flowRepo.incrementStats(exec.flowId, failed ? { failed: 1 } : { completed: 1 });

    const flow = await this.flowRepo.findById(exec.flowId);
    const flowName = flow?.name ?? 'Automatización';
    try {
      const event = await this.eventRepo.create({
        conversationId: exec.conversationId,
        tenantId: exec.tenantId,
        type: failed ? ConversationEventType.FLOW_FAILED : ConversationEventType.FLOW_COMPLETED,
        performedBy: null,
        data: { flowName, flowId: exec.flowId, reason: endReason, ...(exec.error ? { message: exec.error.message } : {}) },
      });
      this.gateway.emitToConversation(exec.conversationId, 'conversation.event', event);
    } catch (error: any) {
      this.logger.warn(`No se pudo crear el evento de fin de flujo: ${error?.message}`);
    }
    this.gateway.emitToTenant(exec.tenantId, 'flow.execution.finished', {
      flowId: exec.flowId,
      executionId: exec.id,
      conversationId: exec.conversationId,
      status,
    });

    // Webhooks m2m: un integrador puede reaccionar a "el flujo terminó" o
    // "el flujo falló" sin sondear la API.
    this.devEvents.emit(
      exec.tenantId,
      failed ? DeveloperEventType.FLOW_FAILED : DeveloperEventType.FLOW_COMPLETED,
      {
        flowId: exec.flowId,
        flowName,
        executionId: exec.id,
        conversationId: exec.conversationId,
        contactId: exec.contactId,
        endReason,
        ...(exec.error ? { error: exec.error } : {}),
        variables: (exec.variables?.vars as Record<string, unknown>) ?? {},
      },
    );
    this.gateway.emitToTenant(exec.tenantId, 'conversation.updated', { conversationId: exec.conversationId });

    // Fallback: un flujo fallado no puede dejar al cliente en el limbo.
    if (failed) {
      const conversation = await this.conversationRepo.findById(exec.conversationId);
      if (conversation && !conversation.agentId) {
        await this.autoAssign.execute(exec.conversationId).catch(() => null);
      }
    }

    // Delegación al bot: recién ahora la ejecución está cerrada, así que el
    // guard de "un flujo es dueño de la conversación" ya no descarta el job.
    if (!failed && delegateToAiNodeId) {
      await this.jobQueue.enqueue(AI_RESPONSE_JOB, { conversationId: exec.conversationId });
    }
  }
}
