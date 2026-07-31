import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import { Flow, FlowGraph } from '../../../domain/entities/flow.entity.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { Result, ok } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { getFlowTemplate } from './flow-templates.js';

export interface CreateFlowInputDto {
  tenantId: string;
  createdByAgentId: string;
  name: string;
  description?: string;
  templateId?: string;
}

const EMPTY_GRAPH: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger.inbound_message',
      position: { x: 80, y: 200 },
      data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
    },
  ],
  edges: [],
};

export class CreateFlowUseCase {
  constructor(private readonly flowRepo: FlowRepository) {}

  async execute(input: CreateFlowInputDto): Promise<Result<Flow, DomainError>> {
    const template = input.templateId ? getFlowTemplate(input.templateId) : null;
    const existing = await this.flowRepo.findByTenantId(input.tenantId);
    const maxPriority = existing.reduce((max, f) => Math.max(max, f.priority), 0);

    const flow = await this.flowRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      status: FlowStatus.DRAFT,
      draftGraph: template ? template.graph : EMPTY_GRAPH,
      publishedVersionId: null,
      publishedVersion: null,
      priority: maxPriority + 10,
      webhookToken: null,
      stats: { started: 0, completed: 0, failed: 0, cancelled: 0 },
      createdByAgentId: input.createdByAgentId,
    });
    return ok(flow);
  }
}
