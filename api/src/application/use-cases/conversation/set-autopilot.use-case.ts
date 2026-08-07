// ── Piloto automático de una conversación ────────────────────────
// Prender y apagar las automatizaciones de un chat sin perder dónde iban.
//
// Reemplaza al viejo "tomar el chat para que el bot deje de contestar": eso
// asignaba la conversación a una persona, cancelaba la ejecución y no tenía
// vuelta atrás. Acá apagar es reversible y no toca quién es el responsable.

import { Logger } from '@nestjs/common';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import type { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import type { JobQueuePort } from '../../ports/job-queue.port.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import type { AutopilotPausedReason, ConversationAutopilot } from '../../../domain/entities/conversation.entity.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';
import { FLOW_EXECUTE_JOB, FLOW_RESUME_JOB, FlowResumeJobData } from '../flow/flow-jobs.constants.js';

export interface SetAutopilotInput {
  conversationId: string;
  tenantId: string;
  enabled: boolean;
  reason: AutopilotPausedReason;
  /** Null cuando lo apaga el sistema y no una persona. */
  performedBy: string | null;
}

export class SetAutopilotUseCase {
  private readonly logger = new Logger(SetAutopilotUseCase.name);

  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly execRepo: FlowExecutionRepository,
    private readonly flowRepo: FlowRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(input: SetAutopilotInput): Promise<Result<ConversationAutopilot, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation || conversation.tenantId !== input.tenantId) return err(new ConversationNotFoundError());

    // El puntero al nodo de IA se conserva: prender y apagar el piloto no
    // cambia quién atiende, solo si puede actuar.
    const aiNode = conversation.autopilot.aiNode;
    const autopilot: ConversationAutopilot = input.enabled
      ? { enabled: true, pausedReason: null, pausedAt: null, aiNode }
      : { enabled: false, pausedReason: input.reason, pausedAt: new Date(), aiNode };

    // Idempotente: apagar dos veces no reescribe pausedAt ni duplica el evento.
    if (conversation.autopilot.enabled === input.enabled) return ok(conversation.autopilot);

    await this.conversationRepo.update(input.conversationId, { autopilot } as any);

    const flowName = input.enabled
      ? await this.resumeFlow(input.conversationId)
      : await this.pauseFlow(input.conversationId, input.reason);

    await this.record(input, flowName);
    return ok(autopilot);
  }

  /** Congela la ejecución viva, si hay. Devuelve el nombre del flujo frenado. */
  private async pauseFlow(conversationId: string, reason: string): Promise<string | null> {
    try {
      const paused = await this.execRepo.pauseActiveByConversation(conversationId, reason);
      if (!paused) return null;
      const flow = await this.flowRepo.findById(paused.flowId);
      return flow?.name ?? 'Automatización';
    } catch (error: any) {
      // Apagar el piloto nunca puede fallar por culpa de la ejecución: lo que
      // importa es que la conversación quede marcada y el bot deje de hablar.
      this.logger.warn(`No se pudo pausar la ejecución de ${conversationId}: ${error?.message}`);
      return null;
    }
  }

  /** Devuelve la ejecución pausada a la vida y reencola el job que le toca. */
  private async resumeFlow(conversationId: string): Promise<string | null> {
    try {
      const resumed = await this.execRepo.resumePausedByConversation(conversationId);
      if (!resumed) return null;

      if (resumed.waitState?.kind === 'delay') {
        // La espera venció mientras estaba en pausa: se sigue ya mismo. Si no,
        // se reencola para el momento en que corresponde.
        const at = resumed.waitState.timeoutAt;
        await this.jobQueue.schedule(
          FLOW_RESUME_JOB,
          { executionId: resumed.id, token: resumed.resumeToken, reason: 'timeout' } satisfies FlowResumeJobData,
          at.getTime() <= Date.now() ? new Date() : at,
        );
      } else if (!resumed.waitState) {
        // Quedó a mitad de un paso: se retoma la ejecución donde estaba.
        await this.jobQueue.enqueue(FLOW_EXECUTE_JOB, { executionId: resumed.id, token: resumed.resumeToken });
      }
      // waitState 'reply': no hay nada que encolar, lo despierta el próximo
      // mensaje del cliente a través del router.

      const flow = await this.flowRepo.findById(resumed.flowId);
      return flow?.name ?? 'Automatización';
    } catch (error: any) {
      this.logger.warn(`No se pudo retomar la ejecución de ${conversationId}: ${error?.message}`);
      return null;
    }
  }

  private async record(input: SetAutopilotInput, flowName: string | null): Promise<void> {
    try {
      const event = await this.eventRepo.create({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        type: input.enabled ? ConversationEventType.AUTOPILOT_ON : ConversationEventType.AUTOPILOT_OFF,
        performedBy: input.performedBy,
        data: { reason: input.reason, flowName },
      });
      this.gateway.emitToConversation(input.conversationId, 'conversation.event', event);
    } catch (error: any) {
      this.logger.warn(`No se pudo registrar el cambio de piloto: ${error?.message}`);
    }
    this.gateway.emitToTenant(input.tenantId, 'conversation.updated', { conversationId: input.conversationId });
  }
}
