// ── Dobles de prueba del simulador de flujos ─────────────────────
//
// El probador corre el MOTOR REAL (`FlowEngineService`): un simulador aparte
// se desincronizaría y mostraría algo distinto de lo que pasa en producción.
// Lo que se reemplaza son los bordes del mundo:
//
//   - WhatsApp    → se capturan los envíos en vez de mandarlos
//   - Persistencia→ en memoria, hidratada desde la sesión que manda el cliente
//   - Webhooks/WS → no-op (una prueba no puede disparar los webhooks del tenant)
//   - Métricas    → no-op (una prueba no ensucia el funnel ni el uso de IA)
//   - HTTP        → respuesta simulada configurable (un POST real crearía un
//                   pedido de verdad en el CRM del cliente)
//
// Los repos que solo LEEN (flujo, versión, plantillas, etiquetas, agentes,
// líneas, config de IA) se usan reales: no tienen efectos y así el probador
// valida contra los datos verdaderos del tenant.

import { randomUUID } from 'node:crypto';
import type { FlowExecutionRepository, CreateFlowExecutionInput, FlowExecutionCasPatch } from '../../../../domain/repositories/flow-execution.repository.js';
import type { ConversationRepository, FindOrCreateResult, ConversationFilters, PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import type { MessageRepository, UpsertMessageInput } from '../../../../domain/repositories/message.repository.js';
import type { ContactRepository, BulkUpsertContactRow } from '../../../../domain/repositories/contact.repository.js';
import type { ConversationEventRepository } from '../../../../domain/repositories/conversation-event.repository.js';
import type { ConversationNoteRepository } from '../../../../domain/repositories/conversation-note.repository.js';
import type { ConversationLabelRepository } from '../../../../domain/repositories/conversation-label.repository.js';
import type { FlowNodeStatRepository } from '../../../../domain/repositories/flow-node-stat.repository.js';
import type { AiUsageRepository } from '../../../../domain/repositories/ai-usage.repository.js';
import type { AgentPhoneAccessRepository } from '../../../../domain/repositories/agent-phone-access.repository.js';
import type { FlowNodeStat } from '../../../../domain/entities/flow-node-stat.entity.js';
import type { AiUsage } from '../../../../domain/entities/ai-usage.entity.js';
import type { AgentPhoneAccess } from '../../../../domain/entities/agent-phone-access.entity.js';
import type { FlowExecution } from '../../../../domain/entities/flow-execution.entity.js';
import type { Conversation } from '../../../../domain/entities/conversation.entity.js';
import type { Contact } from '../../../../domain/entities/contact.entity.js';
import type { Message } from '../../../../domain/entities/message.entity.js';
import type { ConversationEvent } from '../../../../domain/entities/conversation-event.entity.js';
import type { ConversationNote } from '../../../../domain/entities/conversation-note.entity.js';
import type { ConversationLabel } from '../../../../domain/entities/conversation-label.entity.js';
import type { MessagingApiPort, SendMessageParams, SendMessageResult } from '../../../ports/messaging-api.port.js';
import type { RealtimeGatewayPort } from '../../../ports/realtime-gateway.port.js';
import type { DeveloperEventsPort } from '../../../ports/developer-events.port.js';
import type { JobQueuePort } from '../../../ports/job-queue.port.js';
import type { FlowHttpPort, FlowHttpRequest, FlowHttpResponse } from '../../../ports/flow-http.port.js';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';

/** Lo que el cliente "vería" en WhatsApp durante la prueba */
export interface SimulatedOutbound {
  type: string;
  body: string | null;
  mediaUrl?: string | null;
  interactive?: Record<string, unknown> | null;
  templateName?: string | null;
}

/** Acciones que no se ejecutan de verdad pero conviene mostrar en la traza */
export interface SimulatedSideEffect {
  kind: 'assign' | 'label' | 'note' | 'contact' | 'event' | 'http' | 'ai_handoff';
  detail: string;
}

export class SimulationRecorder {
  readonly outbound: SimulatedOutbound[] = [];
  readonly sideEffects: SimulatedSideEffect[] = [];

  effect(kind: SimulatedSideEffect['kind'], detail: string): void {
    this.sideEffects.push({ kind, detail });
  }
}

// ── WhatsApp: captura en lugar de enviar ─────────────────────────

export class RecordingMessagingApi implements MessagingApiPort {
  constructor(private readonly recorder: SimulationRecorder) {}

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    this.recorder.outbound.push({
      type: params.type,
      body: params.body ?? null,
      mediaUrl: params.mediaUrl ?? null,
      interactive: (params.interactive as unknown as Record<string, unknown>) ?? null,
      templateName: params.template?.name ?? null,
    });
    return { waMessageId: `sim-${randomUUID()}` };
  }

  async sendTypingIndicator(): Promise<void> {
    // En la prueba no hay a quién mostrarle "escribiendo…".
  }
}

// ── HTTP: respuesta simulada ─────────────────────────────────────

export class SimulatedFlowHttp implements FlowHttpPort {
  constructor(
    private readonly recorder: SimulationRecorder,
    /** Respuesta que devuelve cualquier llamada durante la prueba */
    private readonly canned: { status: number; body: unknown },
  ) {}

  async request(req: FlowHttpRequest): Promise<FlowHttpResponse> {
    // Nunca se llama de verdad: un POST real crearía un pedido/cobro auténtico.
    this.recorder.effect('http', `${req.method} ${req.url} → simulado ${this.canned.status}`);
    return { status: this.canned.status, body: this.canned.body };
  }
}

// ── Tiempo real / webhooks / métricas: sin efecto ────────────────

export class NoopGateway implements RealtimeGatewayPort {
  emitToAgent(): void {}
  emitToTenant(): void {}
  emitToConversation(): void {}
}

export class NoopDeveloperEvents implements DeveloperEventsPort {
  constructor(private readonly recorder: SimulationRecorder) {}
  emit(_tenantId: string, type: string, _data: Record<string, unknown>): void {
    this.recorder.effect('event', `Evento ${type} (no se entrega en la prueba)`);
  }
}

export class NoopNodeStats implements FlowNodeStatRepository {
  async increment(): Promise<void> {}
  async findByFlowId(): Promise<FlowNodeStat[]> {
    return [];
  }
}

/** El uso de la prueba no descuenta del límite diario del bot. */
export class NoopAiUsage implements AiUsageRepository {
  async incrementUsage(tenantId: string, aiAgentId: string, date: string): Promise<AiUsage> {
    return { id: 'sim', tenantId, aiAgentId, date, messageCount: 0, tokenCount: 0 } as AiUsage;
  }
  async getUsage(): Promise<AiUsage | null> {
    return null;
  }
}

// ── Estado en memoria ────────────────────────────────────────────

export class InMemoryFlowExecutionRepository implements FlowExecutionRepository {
  constructor(private execution: FlowExecution | null = null) {}

  get current(): FlowExecution | null {
    return this.execution;
  }

  async tryCreateActive(input: CreateFlowExecutionInput): Promise<FlowExecution | null> {
    this.execution = { ...input, id: 'sim-exec', createdAt: new Date(), updatedAt: new Date() } as FlowExecution;
    return this.execution;
  }

  async findById(): Promise<FlowExecution | null> {
    return this.execution;
  }

  async findActiveByConversationId(): Promise<FlowExecution | null> {
    if (!this.execution) return null;
    const active =
      this.execution.status === FlowExecutionStatus.RUNNING || this.execution.status === FlowExecutionStatus.WAITING;
    return active ? this.execution : null;
  }

  async casClaim(
    _id: string,
    from: FlowExecutionStatus,
    token: string,
    patch: FlowExecutionCasPatch,
  ): Promise<FlowExecution | null> {
    if (!this.execution || this.execution.status !== from || this.execution.resumeToken !== token) return null;
    this.execution = { ...this.execution, ...patch, updatedAt: new Date() } as FlowExecution;
    return this.execution;
  }

  async advanceCursor(
    _id: string,
    token: string,
    patch: FlowExecutionCasPatch,
    step: FlowExecution['steps'][number],
  ): Promise<FlowExecution | null> {
    if (!this.execution || this.execution.status !== FlowExecutionStatus.RUNNING || this.execution.resumeToken !== token) {
      return null;
    }
    this.execution = {
      ...this.execution,
      ...patch,
      steps: [...this.execution.steps, step],
      stepCount: this.execution.stepCount + 1,
      updatedAt: new Date(),
    } as FlowExecution;
    return this.execution;
  }

  async cancelActiveByConversation(): Promise<FlowExecution | null> {
    return null;
  }
  async cancelActiveByFlowId(): Promise<number> {
    return 0;
  }
  async findStaleRunning(): Promise<FlowExecution[]> {
    return [];
  }
  async findExpiredWaiting(): Promise<FlowExecution[]> {
    return [];
  }
  async findByFlowId(): Promise<PaginatedResult<FlowExecution>> {
    return { data: [], meta: { total: 0, page: 1, pages: 0 } };
  }
  async countStartedSince(): Promise<number> {
    return 0;
  }
}

export class InMemoryConversationRepository implements ConversationRepository {
  constructor(private conversation: Conversation) {}

  get current(): Conversation {
    return this.conversation;
  }

  async findById(): Promise<Conversation | null> {
    return this.conversation;
  }
  async update(_id: string, data: Partial<Conversation>): Promise<Conversation | null> {
    this.conversation = { ...this.conversation, ...data } as Conversation;
    return this.conversation;
  }
  async create(): Promise<Conversation> {
    return this.conversation;
  }
  async findOrCreateByContactAndPhone(): Promise<FindOrCreateResult> {
    return { conversation: this.conversation, created: false };
  }
  async findOpenByContactAndPhone(): Promise<Conversation | null> {
    return this.conversation;
  }
  async findByContactAndPhone(): Promise<Conversation | null> {
    return this.conversation;
  }
  async findByFilters(_filters: ConversationFilters): Promise<PaginatedResult<Conversation>> {
    return { data: [], meta: { total: 0, page: 1, pages: 0 } };
  }
  async findActiveByAgentId(): Promise<Conversation[]> {
    return [];
  }
  async findActiveByAgentAndPhone(): Promise<Conversation[]> {
    return [];
  }
  async incrementUnread(): Promise<void> {}
  async clearUnread(): Promise<void> {}
  async countByTenantIdSince(): Promise<number> {
    return 0;
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  constructor(private messages: Message[] = []) {}

  get all(): Message[] {
    return this.messages;
  }

  async upsertByWaMessageId(input: UpsertMessageInput): Promise<Message> {
    const message = { ...input, id: `sim-msg-${this.messages.length}` } as Message;
    this.messages.push(message);
    return message;
  }

  async findByConversationId(_id: string, page: number, limit: number): Promise<PaginatedResult<Message>> {
    // El motor pide las últimas N y las usa como historial del LLM.
    const data = this.messages.slice(-limit);
    return { data, meta: { total: this.messages.length, page, pages: 1 } };
  }

  async findById(id: string): Promise<Message | null> {
    return this.messages.find((m) => m.id === id) ?? null;
  }

  async attachMediaAsset(): Promise<Message | null> {
    return null;
  }

  async updateStatusByWaMessageId(): Promise<Message | null> {
    return null;
  }
}

export class InMemoryContactRepository implements ContactRepository {
  constructor(private contact: Contact) {}

  get current(): Contact {
    return this.contact;
  }

  async findById(): Promise<Contact | null> {
    return this.contact;
  }
  async update(_id: string, data: Partial<Contact>): Promise<Contact | null> {
    this.contact = { ...this.contact, ...data } as Contact;
    return this.contact;
  }
  async create(): Promise<Contact> {
    return this.contact;
  }
  async applyIdentity(): Promise<Contact | null> {
    return this.contact;
  }
  async findByPhone(): Promise<Contact | null> {
    return this.contact;
  }
  async findByBsuid(): Promise<Contact | null> {
    return this.contact;
  }
  async findByTenantId(): Promise<PaginatedResult<Contact>> {
    return { data: [], meta: { total: 0, page: 1, pages: 0 } };
  }
  async bulkUpsertByPhone(_t: string, _rows: BulkUpsertContactRow[]): Promise<{ inserted: number; updated: number }> {
    return { inserted: 0, updated: 0 };
  }
  async delete(): Promise<void> {}
  async findByIds(): Promise<Contact[]> {
    return [this.contact];
  }
}

export class RecordingEventRepository implements ConversationEventRepository {
  constructor(private readonly recorder: SimulationRecorder) {}
  async create(event: Omit<ConversationEvent, 'id' | 'createdAt'>): Promise<ConversationEvent> {
    return { ...event, id: 'sim-event', createdAt: new Date() } as ConversationEvent;
  }
  async findByConversationId(): Promise<ConversationEvent[]> {
    return [];
  }
}

export class RecordingNoteRepository implements ConversationNoteRepository {
  constructor(private readonly recorder: SimulationRecorder) {}
  async create(note: Omit<ConversationNote, 'id' | 'createdAt'>): Promise<ConversationNote> {
    this.recorder.effect('note', `Nota interna: ${note.body.substring(0, 80)}`);
    return { ...note, id: 'sim-note', createdAt: new Date() } as ConversationNote;
  }
  async findByConversationId(): Promise<ConversationNote[]> {
    return [];
  }
}

export class RecordingConversationLabelRepository implements ConversationLabelRepository {
  private labels: ConversationLabel[] = [];
  constructor(private readonly recorder: SimulationRecorder) {}

  async create(data: Omit<ConversationLabel, 'id' | 'createdAt'>): Promise<ConversationLabel> {
    const label = { ...data, id: `sim-cl-${this.labels.length}`, createdAt: new Date() } as ConversationLabel;
    this.labels.push(label);
    return label;
  }
  async delete(_conversationId: string, labelId: string): Promise<void> {
    this.labels = this.labels.filter((l) => l.labelId !== labelId);
  }
  async findByConversationId(): Promise<ConversationLabel[]> {
    return this.labels;
  }
  async findByConversationIds(): Promise<ConversationLabel[]> {
    return this.labels;
  }
  async findByLabelId(): Promise<ConversationLabel[]> {
    return [];
  }
  async deleteByLabelId(): Promise<void> {}
}

export class NoopPhoneAccess implements AgentPhoneAccessRepository {
  async create(access: AgentPhoneAccess): Promise<AgentPhoneAccess> {
    return access;
  }
  async delete(): Promise<boolean> {
    return true;
  }
  async findByAgentId(): Promise<AgentPhoneAccess[]> {
    return [];
  }
  async findByPhoneNumberId(): Promise<AgentPhoneAccess[]> {
    return [];
  }
  async exists(): Promise<boolean> {
    return false;
  }
}

/**
 * Cola de la prueba: las continuaciones (`flow.execute` cuando se agota el
 * presupuesto de nodos) se resuelven en el mismo tick; los `flow.resume`
 * agendados —timeouts— NO se ejecutan: la prueba corta ahí y le devuelve el
 * control a quien está probando.
 */
export class SimulationJobQueue implements JobQueuePort {
  readonly pendingContinuations: Array<{ jobName: string; data: unknown }> = [];

  async enqueue(jobName: string, data: unknown): Promise<void> {
    this.pendingContinuations.push({ jobName, data });
  }
  async schedule(): Promise<void> {
    // Los timeouts no corren en la prueba: se avisa en la UI.
  }
  async every(): Promise<void> {}
}
