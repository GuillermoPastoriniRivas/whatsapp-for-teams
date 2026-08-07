// ── Alta de la automatización base de un número ──────────────────
// Un número sin automatización base es un número donde nadie contesta. Este
// caso de uso la crea y la publica, y es idempotente: si ya existe, no toca
// nada. Lo llaman el alta de números y el script de migración.

import { Logger } from '@nestjs/common';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { CreateFlowUseCase } from './create-flow.use-case.js';
import { PublishFlowUseCase } from './publish-flow.use-case.js';
import {
  DEFAULT_FLOW_DESCRIPTION,
  DefaultResponder,
  buildDefaultPhoneFlowGraph,
  defaultFlowName,
} from './default-phone-flow.js';

export interface EnsureDefaultPhoneFlowInput {
  tenantId: string;
  phoneNumberId: string;
  phoneLabel: string;
  /** Quién queda como autor. Si no viene se usa un admin del tenant. */
  createdByAgentId?: string;
  /** Por defecto, el equipo — es lo que hacía el pipeline viejo. */
  responder?: DefaultResponder;
}

export interface EnsureDefaultPhoneFlowResult {
  flowId: string;
  created: boolean;
  published: boolean;
}

export class EnsureDefaultPhoneFlowUseCase {
  private readonly logger = new Logger(EnsureDefaultPhoneFlowUseCase.name);

  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly agentRepo: AgentRepository,
    private readonly createFlow: CreateFlowUseCase,
    private readonly publishFlow: PublishFlowUseCase,
  ) {}

  async execute(input: EnsureDefaultPhoneFlowInput): Promise<EnsureDefaultPhoneFlowResult | null> {
    const existing = await this.flowRepo.findDefaultByPhoneNumberId(input.phoneNumberId);
    if (existing) {
      return { flowId: existing.id, created: false, published: existing.publishedVersionId !== null };
    }

    const authorId = input.createdByAgentId ?? (await this.findAuthor(input.tenantId));
    if (!authorId) {
      // Tenant sin ningún agente: pasa en el alta por API antes de invitar a
      // nadie. El script de migración lo vuelve a intentar más adelante.
      this.logger.warn(`Sin autor para la automatización base de ${input.phoneNumberId}: se omite`);
      return null;
    }

    const responder: DefaultResponder = input.responder ?? { kind: 'team' };
    const created = await this.createFlow.execute({
      tenantId: input.tenantId,
      createdByAgentId: authorId,
      name: defaultFlowName(input.phoneLabel),
      description: DEFAULT_FLOW_DESCRIPTION,
      defaultForPhoneNumberId: input.phoneNumberId,
      draftGraph: buildDefaultPhoneFlowGraph(input.phoneNumberId, responder),
    });
    if (!created.ok) {
      this.logger.error(`No se pudo crear la automatización base de ${input.phoneNumberId}: ${created.error.message}`);
      return null;
    }

    const flowId = created.value.id;
    const published = await this.publishFlow.execute(input.tenantId, flowId, authorId);
    if (!published.ok) {
      // Queda en borrador. El router tiene su propia red de seguridad, así que
      // esto degrada la visibilidad, no la atención de los chats.
      this.logger.error(
        `La automatización base de ${input.phoneNumberId} quedó en borrador: ${published.error.message}`,
      );
      return { flowId, created: true, published: false };
    }

    return { flowId, created: true, published: true };
  }

  /** Un admin del tenant; si no hay, cualquier humano. */
  private async findAuthor(tenantId: string): Promise<string | null> {
    const agents = await this.agentRepo.findByTenantId(tenantId);
    const humans = agents.filter((a) => a.type === AgentType.HUMAN);
    const admin = humans.find((a) => a.role === AgentRole.ADMIN);
    return (admin ?? humans[0])?.id ?? null;
  }
}
