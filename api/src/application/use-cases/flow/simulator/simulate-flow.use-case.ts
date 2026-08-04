// ── Probador de flujos ───────────────────────────────────────────
// Corre el motor real contra dobles de prueba. La sesión es stateless: el
// estado (ejecución, conversación, contacto, mensajes) viaja al cliente y
// vuelve en el request siguiente, así una prueba no deja nada en la base ni
// hay sesiones que limpiar.

import { randomBytes } from 'node:crypto';
import type { FlowRepository } from '../../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../../domain/repositories/flow-version.repository.js';
import type { FlowConnectionRepository } from '../../../../domain/repositories/flow-connection.repository.js';
import type { PhoneNumberRepository } from '../../../../domain/repositories/phone-number.repository.js';
import type { AgentRepository } from '../../../../domain/repositories/agent.repository.js';
import type { AiAgentConfigRepository } from '../../../../domain/repositories/ai-agent-config.repository.js';
import type { LabelRepository } from '../../../../domain/repositories/label.repository.js';
import type { MessageTemplateRepository } from '../../../../domain/repositories/message-template.repository.js';
import type { AiCompletionPort } from '../../../ports/ai-completion.port.js';
import type { FlowSecretsPort } from '../../../ports/flow-secrets.port.js';
import type { MediaAssetRepository } from '../../../../domain/repositories/media-asset.repository.js';
import type { MediaAccessService } from '../../media/media-access.service.js';
import { Flow } from '../../../../domain/entities/flow.entity.js';
import { FlowVersion } from '../../../../domain/entities/flow-version.entity.js';
import { FlowExecution } from '../../../../domain/entities/flow-execution.entity.js';
import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { Contact } from '../../../../domain/entities/contact.entity.js';
import { Message } from '../../../../domain/entities/message.entity.js';
import { Agent } from '../../../../domain/entities/agent.entity.js';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';
import { ConversationOrigin } from '../../../../domain/enums/conversation-origin.enum.js';
import { MessageDirection } from '../../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../../domain/enums/message-wa-status.enum.js';
import { AgentType } from '../../../../domain/enums/agent-type.enum.js';
import { AgentStatus } from '../../../../domain/enums/agent-status.enum.js';
import { AgentRole } from '../../../../domain/enums/agent-role.enum.js';
import { Result, ok, err } from '../../../common/result.js';
import { DomainError, FlowNotFoundError } from '../../../../domain/errors/domain-errors.js';
import { AutoAssignConversationUseCase } from '../../conversation/auto-assign-conversation.use-case.js';
import { FlowEngineService } from '../engine/flow-engine.service.js';
import { isTrigger } from '../engine/flow-node-types.js';
import {
  SimulationRecorder, RecordingMessagingApi, SimulatedFlowHttp, NoopGateway, NoopDeveloperEvents,
  NoopNodeStats, NoopAiUsage, InMemoryFlowExecutionRepository, InMemoryConversationRepository,
  InMemoryMessageRepository, InMemoryContactRepository, RecordingEventRepository, RecordingNoteRepository,
  RecordingConversationLabelRepository, NoopPhoneAccess, SimulationJobQueue,
  type SimulatedOutbound, type SimulatedSideEffect,
} from './simulator-doubles.js';

export interface SimulationSession {
  execution: FlowExecution;
  conversation: Conversation;
  contact: Contact;
  messages: Message[];
}

export interface SimulateFlowInput {
  tenantId: string;
  flowId: string;
  /** 'draft' prueba lo que está en el editor; 'published' lo que corre hoy */
  source: 'draft' | 'published';
  session: SimulationSession | null;
  /** Mensaje del "cliente"; en el arranque es el que dispara el flujo */
  text?: string;
  /** Id de la opción tocada (botón/fila), como llegaría de WhatsApp */
  optionId?: string;
  /** Respuesta con la que se simulan todas las llamadas HTTP */
  httpResponse?: { status: number; body: unknown };
}

export interface SimulateFlowOutput {
  session: SimulationSession;
  status: FlowExecutionStatus;
  /** Lo que el cliente habría recibido en este turno */
  outbound: SimulatedOutbound[];
  sideEffects: SimulatedSideEffect[];
  /** Nodos recorridos en este turno */
  steps: FlowExecution['steps'];
  currentNodeId: string | null;
  variables: Record<string, unknown>;
  endReason: string | null;
  error: { nodeId: string; message: string } | null;
  /** true si quedó esperando un timeout que en la prueba no va a dispararse */
  waitingOnTimer: boolean;
}

const SIM_IDS = {
  conversation: 'sim-conversation',
  contact: 'sim-contact',
  execution: 'sim-exec',
};

export class SimulateFlowUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
    private readonly connectionRepo: FlowConnectionRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
    private readonly aiConfigRepo: AiAgentConfigRepository,
    private readonly labelRepo: LabelRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly aiCompletion: AiCompletionPort,
    private readonly secrets: FlowSecretsPort,
    // Media: solo se leen (resolver el archivo a enviar), así que van los reales
    // y la prueba detecta un asset vencido igual que producción.
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
  ) {}

  async execute(input: SimulateFlowInput): Promise<Result<SimulateFlowOutput, DomainError>> {
    const flow = await this.flowRepo.findById(input.flowId);
    if (!flow || flow.tenantId !== input.tenantId) return err(new FlowNotFoundError());

    const graph = await this.resolveGraph(flow, input.source);
    if (!graph) {
      return err(new DomainError('FLOW_NOT_PUBLISHED', 'Este flujo todavía no tiene una versión publicada para probar.'));
    }

    const triggerNode = graph.nodes.find((n) => isTrigger(n.type));
    if (!triggerNode) return err(new DomainError('FLOW_NO_TRIGGER', 'El flujo no tiene disparador.'));

    // Línea: la del disparador si la fijó, si no la primera activa del tenant.
    const phone = await this.resolvePhone(input.tenantId, triggerNode.data as Record<string, unknown>);
    if (!phone) {
      return err(new DomainError('NO_ACTIVE_PHONE', 'No hay ningún número de WhatsApp activo para simular el envío.'));
    }

    const session = input.session ? reviveSession(input.session) : null;
    const recorder = new SimulationRecorder();
    const version = this.syntheticVersion(flow, graph);
    const hasInbound = !!(input.text || input.optionId);

    // ── Estado ────────────────────────────────────────────────────
    const now = new Date();
    const baseConversation =
      session?.conversation ??
      ({
        id: SIM_IDS.conversation,
        tenantId: input.tenantId,
        phoneNumberId: phone.id,
        contactId: SIM_IDS.contact,
        agentId: null,
        status: ConversationStatus.UNASSIGNED,
        lastMessageAt: now,
        lastInboundAt: now,
        createdAt: now,
        resolvedAt: null,
        closedBy: null,
        summary: null,
        pendingAiSince: null,
        origin: ConversationOrigin.INBOUND,
        hasReplied: true,
        repliedAt: null,
        unreadCount: 0,
      } as Conversation);

    // El mensaje entrante abre la ventana de 24 h, igual que en producción.
    const conversation: Conversation = hasInbound
      ? ({ ...baseConversation, lastInboundAt: new Date() } as Conversation)
      : baseConversation;

    const contact =
      session?.contact ??
      ({
        id: SIM_IDS.contact,
        tenantId: input.tenantId,
        waId: '598999999',
        name: 'Cliente de prueba',
        phone: '598999999',
        profilePicUrl: null,
        lastSeenAt: now,
        createdAt: now,
        email: null,
        company: null,
        notes: null,
        customFields: {},
      } as Contact);

    // El mensaje del cliente entra al historial: el motor lo lee para el
    // contexto de la IA y para resolver la ventana de 24 h.
    const messages = [...(session?.messages ?? [])];
    if (hasInbound) {
      messages.push({
        id: `sim-in-${messages.length}`,
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        messageType: input.optionId ? MessageType.INTERACTIVE : MessageType.TEXT,
        body: input.text ?? null,
        mediaUrl: null,
        mimeType: null,
        waMessageId: `sim-wa-${messages.length}`,
        waStatus: MessageWaStatus.DELIVERED,
        timestamp: new Date(),
        senderAgentId: null,
        senderAgentName: null,
        campaignId: null,
        waErrorCode: null,
        waErrorMessage: null,
        interactiveReplyId: input.optionId ?? null,
        contextWaMessageId: null,
        interactivePayload: null,
      } as Message);
    }

    // ── Motor con los bordes falseados ────────────────────────────
    const execRepo = new InMemoryFlowExecutionRepository(session?.execution ?? null);
    const conversationRepo = new InMemoryConversationRepository(conversation);
    const contactRepo = new InMemoryContactRepository(contact);
    const messageRepo = new InMemoryMessageRepository(messages);
    const jobQueue = new SimulationJobQueue();

    const engine = new FlowEngineService(
      this.readOnlyFlowRepo(),
      this.singleVersionRepo(version),
      execRepo,
      new NoopNodeStats(),
      this.connectionRepo,
      conversationRepo,
      contactRepo,
      this.phoneRepo,
      this.agentRepo,
      this.aiConfigRepo,
      new NoopAiUsage(),
      messageRepo,
      this.labelRepo,
      new RecordingConversationLabelRepository(recorder),
      new RecordingNoteRepository(recorder),
      new RecordingEventRepository(recorder),
      this.templateRepo,
      { encrypt: () => '***', decrypt: () => '***' } satisfies FlowSecretsPort,
      new SimulatedFlowHttp(recorder, input.httpResponse ?? { status: 200, body: {} }),
      new RecordingMessagingApi(recorder),
      this.aiCompletion,
      new NoopGateway(),
      jobQueue,
      this.simulatedAutoAssign(recorder),
      new NoopDeveloperEvents(recorder),
      new NoopPhoneAccess(),
      this.assetRepo,
      this.mediaAccess,
    );

    const stepsBefore = session?.execution?.steps.length ?? 0;

    if (!session) {
      const token = randomBytes(16).toString('hex');
      await execRepo.tryCreateActive({
        tenantId: input.tenantId,
        flowId: flow.id,
        flowVersionId: version.id,
        conversationId: conversation.id,
        contactId: contact.id,
        phoneNumberId: phone.id,
        status: FlowExecutionStatus.RUNNING,
        currentNodeId: triggerNode.id,
        resumeToken: token,
        stepCount: 0,
        waitState: null,
        lastConsumedMessageId: null,
        variables: { message: { body: input.text ?? null, type: 'text' }, vars: {} },
        steps: [],
        triggeredBy: { type: 'message' },
        endReason: null,
        error: null,
        runningSince: new Date(),
        startedAt: new Date(),
        endedAt: null,
      });
      await engine.runExecution(SIM_IDS.execution, token);
    } else {
      const current = execRepo.current;
      if (!current || current.status !== FlowExecutionStatus.WAITING || !current.waitState) {
        return err(new DomainError('SIMULATION_NOT_WAITING', 'La simulación ya terminó. Reiniciala para probar de nuevo.'));
      }
      await engine.resume({
        executionId: SIM_IDS.execution,
        token: current.resumeToken,
        reason: 'reply',
        messageId: messages[messages.length - 1]?.id,
        interactiveReplyId: input.optionId ?? null,
        body: input.text ?? null,
      });
    }

    // El motor re-encola cuando agota el presupuesto de nodos por corrida;
    // en la prueba se resuelve en el acto para que no quede a medio camino.
    let guard = 0;
    while (jobQueue.pendingContinuations.length > 0 && guard++ < 10) {
      const job = jobQueue.pendingContinuations.shift()!;
      const data = job.data as { executionId: string; token: string };
      await engine.runExecution(data.executionId, data.token);
    }

    const final = execRepo.current!;
    return ok({
      session: {
        execution: final,
        conversation: conversationRepo.current,
        contact: contactRepo.current,
        messages: messageRepo.all,
      },
      status: final.status,
      outbound: recorder.outbound,
      sideEffects: recorder.sideEffects,
      steps: final.steps.slice(stepsBefore),
      currentNodeId: final.currentNodeId,
      variables: (final.variables?.vars as Record<string, unknown>) ?? {},
      endReason: final.endReason,
      error: final.error,
      waitingOnTimer: final.status === FlowExecutionStatus.WAITING && final.waitState?.kind === 'delay',
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async resolveGraph(flow: Flow, source: 'draft' | 'published') {
    if (source === 'draft') return flow.draftGraph;
    if (!flow.publishedVersionId) return null;
    const version = await this.versionRepo.findById(flow.publishedVersionId);
    return version?.graph ?? null;
  }

  private async resolvePhone(tenantId: string, triggerData: Record<string, unknown>) {
    const phones = (await this.phoneRepo.findByTenantId(tenantId)).filter((p) => p.status === 'active');
    const configured = Array.isArray(triggerData.phoneNumberIds)
      ? (triggerData.phoneNumberIds as string[])[0]
      : typeof triggerData.phoneNumberId === 'string'
        ? triggerData.phoneNumberId
        : null;
    return (configured ? phones.find((p) => p.id === configured) : undefined) ?? phones[0] ?? null;
  }

  /** Versión sintética: permite probar el borrador sin publicarlo. */
  private syntheticVersion(flow: Flow, graph: Flow['draftGraph']): FlowVersion {
    return {
      id: 'sim-version',
      flowId: flow.id,
      tenantId: flow.tenantId,
      version: flow.publishedVersion ?? 0,
      graph,
      trigger: {
        type: 'inbound_message',
        phoneNumberIds: [],
        match: 'any',
        keywords: [],
        keywordMode: 'contains',
        onlyNewConversations: false,
        ignoreIfAssignedToHuman: false,
        contactPhoneField: null,
        contactNameField: null,
        campaignIds: [],
      },
      publishedByAgentId: flow.createdByAgentId,
      createdAt: new Date(),
    } as FlowVersion;
  }

  private singleVersionRepo(version: FlowVersion): FlowVersionRepository {
    return {
      create: async () => version,
      findById: async () => version,
      findByIds: async () => [version],
      findByFlowId: async () => [version],
      findLatestByFlowId: async () => version,
    };
  }

  /** Lee el flujo real pero no le toca los contadores. */
  private readOnlyFlowRepo(): FlowRepository {
    const repo = this.flowRepo;
    return {
      create: repo.create.bind(repo),
      findById: repo.findById.bind(repo),
      findByTenantId: repo.findByTenantId.bind(repo),
      findPublishedByTenantId: repo.findPublishedByTenantId.bind(repo),
      update: async () => null,
      transitionStatus: async () => null,
      incrementStats: async () => {},
    };
  }

  /**
   * La derivación a un humano no asigna de verdad: devuelve un agente
   * sintético para que el flujo siga por la rama normal y se registre en la
   * traza a quién habría ido.
   */
  private simulatedAutoAssign(recorder: SimulationRecorder): AutoAssignConversationUseCase {
    const fake = {
      execute: async (): Promise<Agent | null> => {
        recorder.effect('assign', 'Se habría derivado a un agente disponible');
        return {
          id: 'sim-agent',
          tenantId: 'sim',
          name: 'Agente de prueba',
          email: 'sim@asis.chat',
          passwordHash: '',
          role: AgentRole.AGENT,
          status: AgentStatus.AVAILABLE,
          activeCount: 0,
          createdAt: new Date(),
          type: AgentType.HUMAN,
          frozen: false,
          emailVerified: true,
          requiresOnboarding: false,
        } as Agent;
      },
    };
    return fake as unknown as AutoAssignConversationUseCase;
  }
}

// ── Rehidratación ────────────────────────────────────────────────
// El estado viaja como JSON, así que las fechas vuelven como string y el
// motor hace .getTime()/.toISOString() sobre ellas.

function toDate<T>(value: T): T {
  return (typeof value === 'string' ? new Date(value) : value) as T;
}

function reviveSession(session: SimulationSession): SimulationSession {
  const execution = {
    ...session.execution,
    runningSince: session.execution.runningSince ? toDate(session.execution.runningSince) : null,
    startedAt: toDate(session.execution.startedAt),
    endedAt: session.execution.endedAt ? toDate(session.execution.endedAt) : null,
    createdAt: toDate(session.execution.createdAt),
    updatedAt: toDate(session.execution.updatedAt),
    waitState: session.execution.waitState
      ? {
          ...session.execution.waitState,
          timeoutAt: toDate(session.execution.waitState.timeoutAt),
          waitingSince: toDate(session.execution.waitState.waitingSince),
        }
      : null,
    steps: session.execution.steps.map((s) => ({ ...s, at: toDate(s.at) })),
  } as FlowExecution;

  const conversation = {
    ...session.conversation,
    lastMessageAt: toDate(session.conversation.lastMessageAt),
    lastInboundAt: toDate(session.conversation.lastInboundAt),
    createdAt: toDate(session.conversation.createdAt),
    resolvedAt: session.conversation.resolvedAt ? toDate(session.conversation.resolvedAt) : null,
    pendingAiSince: session.conversation.pendingAiSince ? toDate(session.conversation.pendingAiSince) : null,
    repliedAt: session.conversation.repliedAt ? toDate(session.conversation.repliedAt) : null,
  } as Conversation;

  return {
    execution,
    conversation,
    contact: {
      ...session.contact,
      lastSeenAt: toDate(session.contact.lastSeenAt),
      createdAt: toDate(session.contact.createdAt),
    } as Contact,
    messages: session.messages.map((m) => ({ ...m, timestamp: toDate(m.timestamp) }) as Message),
  };
}
