// Trigger externo: POST /api/hooks/flows/:flowId/:token — la puerta de
// entrada de CRMs, tiendas, formularios y cualquier sistema de terceros.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import type { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import type { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import type { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import type { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import type { JobQueuePort } from '../../ports/job-queue.port.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { FlowExecutionStatus } from '../../../domain/enums/flow-execution-status.enum.js';
import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationOrigin } from '../../../domain/enums/conversation-origin.enum.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { resolvePath } from './engine/flow-variable.resolver.js';
import { isTrigger } from './engine/flow-node-types.js';
import { FLOW_EXECUTE_JOB } from './flow-jobs.constants.js';

export type WebhookStartResult =
  | { outcome: 'started'; executionId: string }
  | { outcome: 'not_found' }
  | { outcome: 'bad_request'; message: string }
  | { outcome: 'busy' };

export class StartFlowFromWebhookUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
    private readonly execRepo: FlowExecutionRepository,
    private readonly contactRepo: ContactRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(flowId: string, token: string, payload: Record<string, unknown>): Promise<WebhookStartResult> {
    const flow = await this.flowRepo.findById(flowId);
    // 404 también con token inválido: no revelar existencia de flujos.
    if (!flow || flow.status !== FlowStatus.PUBLISHED || !flow.webhookToken || !flow.publishedVersionId) {
      return { outcome: 'not_found' };
    }
    if (!safeEqual(flow.webhookToken, token)) return { outcome: 'not_found' };

    const version = await this.versionRepo.findById(flow.publishedVersionId);
    if (!version || version.trigger.type !== 'webhook') return { outcome: 'not_found' };

    const phoneField = version.trigger.contactPhoneField || 'phone';
    const rawPhone = resolvePath(payload, phoneField);
    const phoneDigits = String(rawPhone ?? '').replace(/[^\d]/g, '');
    if (!phoneDigits || phoneDigits.length < 6) {
      return { outcome: 'bad_request', message: `No se encontró un teléfono válido en "${phoneField}"` };
    }

    const phoneNumberId = version.trigger.phoneNumberIds[0];
    const phone = phoneNumberId ? await this.phoneRepo.findById(phoneNumberId) : null;
    if (!phone || phone.tenantId !== flow.tenantId || phone.status !== 'active') {
      return { outcome: 'bad_request', message: 'La línea configurada en el disparador no está activa' };
    }

    const nameField = version.trigger.contactNameField;
    const contactName = nameField ? String(resolvePath(payload, nameField) ?? '') : '';

    const existing = await this.contactRepo.findByPhone(flow.tenantId, phoneDigits);
    const contact =
      existing ??
      (await this.contactRepo.create(
        flow.tenantId,
        { phone: phoneDigits },
        { name: contactName || phoneDigits },
      ));

    const now = new Date();
    const { conversation } = await this.conversationRepo.findOrCreateByContactAndPhone({
      tenantId: flow.tenantId,
      phoneNumberId: phone.id,
      contactId: contact.id,
      agentId: null,
      status: ConversationStatus.UNASSIGNED,
      lastMessageAt: now,
      // Ventana cerrada por defecto: el flujo debería arrancar con plantilla.
      lastInboundAt: new Date(0),
      pendingAiSince: null,
      origin: ConversationOrigin.INBOUND,
      hasReplied: true,
      repliedAt: null,
    });

    const triggerNode = version.graph.nodes.find((n) => isTrigger(n.type));
    if (!triggerNode) return { outcome: 'bad_request', message: 'La versión publicada no tiene disparador' };

    const executionToken = randomBytes(16).toString('hex');
    const execution = await this.execRepo.tryCreateActive({
      tenantId: flow.tenantId,
      flowId: flow.id,
      flowVersionId: version.id,
      conversationId: conversation.id,
      contactId: contact.id,
      phoneNumberId: phone.id,
      status: FlowExecutionStatus.RUNNING,
      currentNodeId: triggerNode.id,
      resumeToken: executionToken,
      stepCount: 0,
      waitState: null,
      lastConsumedMessageId: null,
      variables: { webhook: sanitizePayload(payload), vars: {} },
      steps: [],
      triggeredBy: { type: 'webhook' },
      endReason: null,
      error: null,
      runningSince: new Date(),
      startedAt: new Date(),
      endedAt: null,
    });

    if (!execution) return { outcome: 'busy' };

    await this.flowRepo.incrementStats(flow.id, { started: 1 });
    try {
      const event = await this.eventRepo.create({
        conversationId: conversation.id,
        tenantId: flow.tenantId,
        type: ConversationEventType.FLOW_STARTED,
        performedBy: null,
        data: { flowId: flow.id, flowName: flow.name, via: 'webhook' },
      });
      this.gateway.emitToConversation(conversation.id, 'conversation.event', event);
    } catch {
      // el evento de timeline nunca bloquea el arranque
    }
    this.gateway.emitToTenant(flow.tenantId, 'flow.execution.started', {
      flowId: flow.id,
      executionId: execution.id,
      conversationId: conversation.id,
    });

    await this.jobQueue.enqueue(FLOW_EXECUTE_JOB, { executionId: execution.id, token: executionToken });
    return { outcome: 'started', executionId: execution.id };
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Payload del webhook: solo JSON plano serializable, cap 32 KB */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > 32 * 1024) return { _truncated: true };
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}
