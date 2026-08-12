import type { FlowConnectionRepository } from '../../../domain/repositories/flow-connection.repository.js';
import type { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import type { LabelRepository } from '../../../domain/repositories/label.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import type { FlowGraphRefs } from './engine/flow-graph.validator.js';

export interface FlowGraphRefsDeps {
  templateRepo: MessageTemplateRepository;
  labelRepo: LabelRepository;
  agentRepo: AgentRepository;
  phoneRepo: PhoneNumberRepository;
  connectionRepo: FlowConnectionRepository;
}

export interface GraphWithNodes {
  nodes: Array<{ type: string; data: Record<string, unknown> }>;
}

/**
 * Lo que el validador necesita saber del mundo para decir si un grafo se puede
 * publicar. Vive acá y no adentro de publicar porque validar sin publicar es
 * justo lo que necesita quien está armando el flujo, sea una persona o un agente.
 */
export async function loadFlowGraphRefs(
  deps: FlowGraphRefsDeps,
  tenantId: string,
  graph: GraphWithNodes,
): Promise<FlowGraphRefs> {
  const templateIds = new Set<string>();
  const connectionIds = new Set<string>();
  for (const node of graph.nodes) {
    const data = node.data as Record<string, any>;
    if (node.type === 'action.send_template' && typeof data.templateId === 'string') {
      templateIds.add(data.templateId);
    }
    if (node.type === 'action.http' && typeof data.connectionId === 'string' && data.connectionId) {
      connectionIds.add(data.connectionId);
    }
  }

  const [labels, agents, phones, templates, connections] = await Promise.all([
    deps.labelRepo.findByTenantId(tenantId),
    deps.agentRepo.findByTenantId(tenantId),
    deps.phoneRepo.findByTenantId(tenantId),
    Promise.all([...templateIds].map((id) => deps.templateRepo.findById(id).catch(() => null))),
    Promise.all([...connectionIds].map((id) => deps.connectionRepo.findById(id).catch(() => null))),
  ]);

  const templateMap = new Map<string, { approved: boolean; phoneNumberId: string }>();
  for (const template of templates) {
    if (template && template.tenantId === tenantId) {
      templateMap.set(template.id, {
        approved: template.status === TemplateStatus.APPROVED,
        phoneNumberId: template.phoneNumberId,
      });
    }
  }

  return {
    templates: templateMap,
    labelIds: new Set(labels.map((label) => label.id)),
    agentIds: new Set(agents.filter((agent) => agent.type === AgentType.HUMAN).map((agent) => agent.id)),
    connectionIds: new Set(connections.filter((item) => item && item.tenantId === tenantId).map((item) => item!.id)),
    phones: new Set(phones.map((phone) => phone.id)),
  };
}
