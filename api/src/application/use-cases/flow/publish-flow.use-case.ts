import { randomBytes } from 'node:crypto';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import type { FlowConnectionRepository } from '../../../domain/repositories/flow-connection.repository.js';
import type { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import type { LabelRepository } from '../../../domain/repositories/label.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { FlowTriggerIndex } from '../../../domain/entities/flow-version.entity.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError, FlowInvalidGraphError, FlowInvalidStateError, PlanLimitExceededError } from '../../../domain/errors/domain-errors.js';
import { CheckPlanLimitUseCase } from '../billing/check-plan-limit.use-case.js';
import { validateFlowGraph, FlowGraphIssue, FlowGraphRefs } from './engine/flow-graph.validator.js';
import { isTrigger } from './engine/flow-node-types.js';

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
      contactPhoneField: typeof data.contactPhoneField === 'string' && data.contactPhoneField ? data.contactPhoneField : null,
      contactNameField: typeof data.contactNameField === 'string' && data.contactNameField ? data.contactNameField : null,
      campaignIds: Array.isArray(data.campaignIds) ? data.campaignIds.map(String) : [],
    };
  }

  private async loadRefs(tenantId: string, graph: { nodes: Array<{ type: string; data: Record<string, unknown> }> }): Promise<FlowGraphRefs> {
    // Referencias usadas por el grafo (pocas por flujo: se cargan por id).
    const templateIds = new Set<string>();
    const connectionIds = new Set<string>();
    for (const node of graph.nodes) {
      const data = node.data as Record<string, any>;
      if (node.type === 'action.send_template' && typeof data.templateId === 'string') templateIds.add(data.templateId);
      if (node.type === 'action.http' && typeof data.connectionId === 'string' && data.connectionId) connectionIds.add(data.connectionId);
    }

    const [labels, agents, phones, templates, connections] = await Promise.all([
      this.labelRepo.findByTenantId(tenantId),
      this.agentRepo.findByTenantId(tenantId),
      this.phoneRepo.findByTenantId(tenantId),
      Promise.all([...templateIds].map((id) => this.templateRepo.findById(id).catch(() => null))),
      Promise.all([...connectionIds].map((id) => this.connectionRepo.findById(id).catch(() => null))),
    ]);

    const templateMap = new Map<string, { approved: boolean; phoneNumberId: string }>();
    for (const template of templates) {
      if (template && template.tenantId === tenantId) {
        templateMap.set(template.id, { approved: template.status === TemplateStatus.APPROVED, phoneNumberId: template.phoneNumberId });
      }
    }

    return {
      templates: templateMap,
      labelIds: new Set(labels.map((l) => l.id)),
      agentIds: new Set(agents.filter((a) => a.type === AgentType.HUMAN).map((a) => a.id)),
      connectionIds: new Set(connections.filter((c) => c && c.tenantId === tenantId).map((c) => c!.id)),
      phones: new Set(phones.map((phone) => phone.id)),
    };
  }
}
