import { FlowExecution, FlowStepLog, FlowWaitState } from '../entities/flow-execution.entity.js';
import { FlowExecutionStatus } from '../enums/flow-execution-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export type CreateFlowExecutionInput = Omit<FlowExecution, 'id' | 'createdAt' | 'updatedAt'>;

export interface FlowExecutionCasPatch {
  status?: FlowExecutionStatus;
  currentNodeId?: string | null;
  resumeToken?: string;
  waitState?: FlowWaitState | null;
  lastConsumedMessageId?: string | null;
  variables?: Record<string, unknown>;
  endReason?: string | null;
  error?: { nodeId: string; message: string } | null;
  runningSince?: Date | null;
  endedAt?: Date | null;
}

export interface FlowExecutionRepository {
  /**
   * Inserta una ejecución activa. El índice único parcial sobre
   * {conversationId, status ∈ running|waiting} garantiza máx. 1 viva por
   * conversación: ante E11000 devuelve null (el caller relee la ganadora).
   */
  tryCreateActive(input: CreateFlowExecutionInput): Promise<FlowExecution | null>;
  findById(id: string): Promise<FlowExecution | null>;
  findActiveByConversationId(conversationId: string): Promise<FlowExecution | null>;
  /**
   * Claim CAS con fencing token: findOneAndUpdate({_id, status: from,
   * resumeToken: token}, {$set: patch}). Devuelve el documento actualizado o
   * null si otro camino ganó (job viejo, cancelación, sweep).
   */
  casClaim(id: string, from: FlowExecutionStatus, token: string, patch: FlowExecutionCasPatch): Promise<FlowExecution | null>;
  /**
   * Avance de cursor guardado por token (worker dueño del claim). Además
   * appendea el step log (cap 200) e incrementa stepCount.
   */
  advanceCursor(
    id: string,
    token: string,
    patch: FlowExecutionCasPatch,
    step: FlowStepLog,
  ): Promise<FlowExecution | null>;
  /**
   * Cancela la ejecución viva de una conversación (intervención humana,
   * botón del inbox, pausa masiva). Rota el token para cercar workers zombie.
   */
  cancelActiveByConversation(conversationId: string, endReason: string): Promise<FlowExecution | null>;
  /** Congela la ejecución viva conservando su punto; el token rota. */
  pauseActiveByConversation(conversationId: string, reason: string): Promise<FlowExecution | null>;
  /** Reanima la pausada. El caller reencola el job según su waitState. */
  resumePausedByConversation(conversationId: string): Promise<FlowExecution | null>;
  /** Cancela todas las vivas de un flujo (emergencia). Devuelve cantidad. */
  cancelActiveByFlowId(flowId: string, endReason: string): Promise<number>;
  /** running colgadas: runningSince < before (crash a mitad de paso) */
  findStaleRunning(before: Date): Promise<FlowExecution[]>;
  /** waiting con timeoutAt < before (job de wake perdido) */
  findExpiredWaiting(before: Date): Promise<FlowExecution[]>;
  findByFlowId(flowId: string, page: number, limit: number, status?: FlowExecutionStatus): Promise<PaginatedResult<FlowExecution>>;
  /** Guard anti-tormenta: ejecuciones iniciadas en la conversación desde `since` */
  countStartedSince(conversationId: string, since: Date): Promise<number>;
}
