import { randomBytes } from 'node:crypto';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import type { FlowConnectionRepository } from '../../../domain/repositories/flow-connection.repository.js';
import type { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import type { LabelRepository } from '../../../domain/repositories/label.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { FlowTriggerIndex, SENDER_TYPES, type SenderType } from '../../../domain/entities/flow-version.entity.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError, FlowInvalidGraphError, FlowInvalidStateError, PlanLimitExceededError } from '../../../domain/errors/domain-errors.js';
import { CheckPlanLimitUseCase } from '../billing/check-plan-limit.use-case.js';
import { validateFlowGraph, FlowGraphIssue, FlowGraphRefs } from './engine/flow-graph.validator.js';
import { loadFlowGraphRefs } from './flow-graph-refs.loader.js';
import { adScopeOf, isTrigger } from './engine/flow-node-types.js';

export interface PublishFlowResult {
  versionId: string;
  version: number;
  warnings: FlowGraphIssue[];
  webhookToken: string | null;
}

export class PublishFlowUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
    private readonly connectionRepo: FlowConnectionRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly labelRepo: LabelRepository,
    private readonly agentRepo: AgentRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly checkPlanLimit: CheckPlanLimitUseCase,
  ) {}

  async execute(tenantId: string, flowId: string, publishedByAgentId: string): Promise<Result<PublishFlowResult, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    if (flow.status === FlowStatus.ARCHIVED) return err(new FlowInvalidStateError('El flujo está archivado.'));

    // Gate de plan solo al PUBLICAR un flujo que no estaba publicado
    // (re-publicar uno ya activo no debe chocar contra su propio conteo).
    // Las automatizaciones base quedan fuera: son el ruteo del número, no un
    // flujo que el tenant decidió armar, y sin ellas nadie contesta.
    if (flow.status !== FlowStatus.PUBLISHED && !flow.defaultForPhoneNumberId) {
      const usage = await this.checkPlanLimit.checkResource(tenantId, 'flows');
      if (!usage.allowed) return err(new PlanLimitExceededError('flows'));
    }

    const refs = await this.loadRefs(tenantId, flow.draftGraph);
    const { errors, warnings } = validateFlowGraph(flow.draftGraph, refs);
    if (errors.length > 0) return err(new FlowInvalidGraphError(errors));

    const triggerNode = flow.draftGraph.nodes.find((n) => isTrigger(n.type))!;
    const trigger = this.buildTriggerIndex(triggerNode.type, triggerNode.data as Record<string, any>);

    const latest = await this.versionRepo.findLatestByFlowId(flowId);
    const version = await this.versionRepo.create({
      flowId,
      tenantId,
      version: (latest?.version ?? 0) + 1,
      graph: flow.draftGraph,
      trigger,
      publishedByAgentId,
    });

    const webhookToken =
      trigger.type === 'webhook' ? flow.webhookToken ?? randomBytes(32).toString('hex') : flow.webhookToken;

    await this.flowRepo.update(flowId, {
      status: FlowStatus.PUBLISHED,
      publishedVersionId: version.id,
      publishedVersion: version.version,
      webhookToken,
    });

    return ok({ versionId: version.id, version: version.version, warnings, webhookToken });
  }

  private buildTriggerIndex(type: string, data: Record<string, any>): FlowTriggerIndex {
    return {
      type: type === 'trigger.webhook' ? 'webhook' : type === 'trigger.campaign_reply' ? 'campaign_reply' : 'inbound_message',
      phoneNumberIds: Array.isArray(data.phoneNumberIds)
        ? data.phoneNumberIds.map(String)
        : data.phoneNumberId
          ? [String(data.phoneNumberId)]
          : [],
      match: data.match === 'keywords' ? 'keywords' : 'any',
      keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
      keywordMode: data.keywordMode === 'exact' ? 'exact' : 'contains',
      onlyNewConversations: data.onlyNewConversations === true,
      senderTypes: Array.isArray(data.senderTypes)
        ? data.senderTypes.map(String).filter((t): t is SenderType => (SENDER_TYPES as string[]).includes(t))
        : [],
      senderLabelIds: Array.isArray(data.senderLabelIds) ? data.senderLabelIds.map(String) : [],
      adScope: adScopeOf(data),
      adSourceIds: Array.isArray(data.adSourceIds) ? data.adSourceIds.map(String) : [],
      contactPhoneField: typeof data.contactPhoneField === 'string' && data.contactPhoneField ? data.contactPhoneField : null,
      contactNameField: typeof data.contactNameField === 'string' && data.contactNameField ? data.contactNameField : null,
      campaignIds: Array.isArray(data.campaignIds) ? data.campaignIds.map(String) : [],
    };
  }

  private async loadRefs(tenantId: string, graph: { nodes: Array<{ type: string; data: Record<string, unknown> }> }): Promise<FlowGraphRefs> {
    return loadFlowGraphRefs(
      {
        templateRepo: this.templateRepo,
        labelRepo: this.labelRepo,
        agentRepo: this.agentRepo,
        phoneRepo: this.phoneRepo,
        connectionRepo: this.connectionRepo,
      },
      tenantId,
      graph,
    );
  }
}
