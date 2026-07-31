// Único camino de cancelación por intervención humana: texto libre de un
// agente, asignación manual o el botón "Detener flujo" del inbox.

import { Logger } from '@nestjs/common';
import type { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import type { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { FlowExecutionStatus } from '../../../domain/enums/flow-execution-status.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';

export class CancelActiveFlowExecutionUseCase {
  private readonly logger = new Logger(CancelActiveFlowExecutionUseCase.name);

  constructor(
    private readonly execRepo: FlowExecutionRepository,
    private readonly flowRepo: FlowRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  /**
   * Cancela la ejecución viva de la conversación (si existe). Nunca lanza:
   * la cancelación no puede romper el envío de un mensaje humano.
   */
  async execute(conversationId: string, endReason: string, performedBy: string | null = null): Promise<boolean> {
    try {
      const cancelled = await this.execRepo.cancelActiveByConversation(conversationId, endReason);
      if (!cancelled) return false;

      await this.flowRepo.incrementStats(cancelled.flowId, { cancelled: 1 });
      const flow = await this.flowRepo.findById(cancelled.flowId);
      const event = await this.eventRepo.create({
        conversationId,
        tenantId: cancelled.tenantId,
        type: ConversationEventType.FLOW_STOPPED,
        performedBy,
        data: { flowId: cancelled.flowId, flowName: flow?.name ?? 'Flujo', reason: endReason },
      });
      this.gateway.emitToConversation(conversationId, 'conversation.event', event);
      this.gateway.emitToTenant(cancelled.tenantId, 'flow.execution.finished', {
        flowId: cancelled.flowId,
        executionId: cancelled.id,
        conversationId,
        status: FlowExecutionStatus.CANCELLED,
      });
      this.gateway.emitToTenant(cancelled.tenantId, 'conversation.updated', { conversationId });
      return true;
    } catch (error: any) {
      this.logger.warn(`No se pudo cancelar la ejecución activa de ${conversationId}: ${error?.message}`);
      return false;
    }
  }
}
