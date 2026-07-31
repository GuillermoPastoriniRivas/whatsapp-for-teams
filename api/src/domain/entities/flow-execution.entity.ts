import { FlowExecutionStatus } from '../enums/flow-execution-status.enum.js';

export interface FlowWaitState {
  nodeId: string;
  kind: 'reply' | 'delay';
  timeoutAt: Date;
  waitingSince: Date;
  saveAs: string | null;
  /** interactiveReplyId ('fl:<nodeId>:<idx>') → handle ('btn:0' / 'row:3') */
  optionMap: Record<string, string> | null;
  /** Títulos normalizados → handle, para matchear texto tipeado y ordinales */
  textMap: Record<string, string> | null;
  /** Reintentos de re-prompt consumidos (ask/buttons/list) */
  attempts: number;
  /** Validación del nodo ask ('texto'|'numero'|'email'|'telefono') */
  validation: string | null;
}

export interface FlowStepLog {
  nodeId: string;
  type: string;
  status: 'ok' | 'error' | 'skipped';
  /** Handle de salida tomado */
  handle: string | null;
  at: Date;
  ms: number;
  note: string | null;
}

export class FlowExecution {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly flowId: string,
    public readonly flowVersionId: string,
    public readonly conversationId: string,
    public readonly contactId: string,
    public readonly phoneNumberId: string,
    public readonly status: FlowExecutionStatus,
    public readonly currentNodeId: string | null,
    /**
     * Fencing token: rotado en cada claim/transición. Todo job (execute,
     * resume, timeout, continuación) debe ganar un CAS sobre {status, resumeToken}
     * para operar. Jobs con token viejo son no-ops.
     */
    public readonly resumeToken: string,
    public readonly stepCount: number,
    public readonly waitState: FlowWaitState | null,
    /**
     * Último mensaje entrante que ya reanudó una espera. Los webhooks se
     * reentregan (retry de Agenda, redelivery de Meta) y el mensaje persistido
     * se deduplica por waMessageId, pero el router volvería a rutearlo: sin
     * esto, un tap viejo respondería la pregunta siguiente.
     */
    public readonly lastConsumedMessageId: string | null,
    public readonly variables: Record<string, unknown>,
    public readonly steps: FlowStepLog[],
    public readonly triggeredBy: { type: 'message' | 'webhook'; messageId?: string },
    public readonly endReason: string | null,
    public readonly error: { nodeId: string; message: string } | null,
    /** Lease del worker para el sweep de ejecuciones colgadas */
    public readonly runningSince: Date | null,
    public readonly startedAt: Date,
    public readonly endedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
