// Consultas y cancelación de ejecuciones desde la API de gestión.

import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import type { FlowNodeStatRepository } from '../../../domain/repositories/flow-node-stat.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import type { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { FlowExecution } from '../../../domain/entities/flow-execution.entity.js';
import { FlowVersion } from '../../../domain/entities/flow-version.entity.js';
import { FlowExecutionStatus } from '../../../domain/enums/flow-execution-status.enum.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError, FlowExecutionNotFoundError } from '../../../domain/errors/domain-errors.js';
import { CancelActiveFlowExecutionUseCase } from './cancel-active-flow-execution.use-case.js';

export interface ExecutionSummary {
  execution: FlowExecution;
  contactName: string | null;
}

export class ListFlowExecutionsUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly execRepo: FlowExecutionRepository,
    private readonly contactRepo: ContactRepository,
  ) {}

  async execute(
    tenantId: string,
    flowId: string,
    page: number,
    limit: number,
    status?: FlowExecutionStatus,
  ): Promise<Result<PaginatedResult<ExecutionSummary>, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());

    const result = await this.execRepo.findByFlowId(flowId, page, limit, status);
    const contacts = await this.contactRepo.findByIds([...new Set(result.data.map((e) => e.contactId))]);
    const nameById = new Map(contacts.map((c) => [c.id, c.name]));

    return ok({
      data: result.data.map((execution) => ({
        execution,
        contactName: nameById.get(execution.contactId) ?? null,
      })),
      meta: result.meta,
    });
  }
}

export class GetFlowExecutionUseCase {
  constructor(private readonly execRepo: FlowExecutionRepository) {}

  async execute(tenantId: string, executionId: string): Promise<Result<FlowExecution, DomainError>> {
    const execution = await this.execRepo.findById(executionId);
    if (!execution || execution.tenantId !== tenantId) return err(new FlowExecutionNotFoundError());
    return ok(execution);
  }
}

export class CancelFlowExecutionUseCase {
  constructor(
    private readonly execRepo: FlowExecutionRepository,
    private readonly cancelActive: CancelActiveFlowExecutionUseCase,
  ) {}

  async execute(tenantId: string, executionId: string, performedBy: string): Promise<Result<void, DomainError>> {
    const execution = await this.execRepo.findById(executionId);
    if (!execution || execution.tenantId !== tenantId) return err(new FlowExecutionNotFoundError());
    if (execution.status === FlowExecutionStatus.RUNNING || execution.status === FlowExecutionStatus.WAITING) {
      await this.cancelActive.execute(execution.conversationId, 'manual', performedBy);
    }
    return ok(undefined);
  }
}

export class GetActiveFlowForConversationUseCase {
  constructor(
    private readonly execRepo: FlowExecutionRepository,
    private readonly flowRepo: FlowRepository,
  ) {}

  async execute(conversationId: string): Promise<{ flowId: string; flowName: string; executionId: string; status: string } | null> {
    const execution = await this.execRepo.findActiveByConversationId(conversationId);
    if (!execution) return null;
    const flow = await this.flowRepo.findById(execution.flowId);
    return {
      flowId: execution.flowId,
      flowName: flow?.name ?? 'Automatización',
      executionId: execution.id,
      status: execution.status,
    };
  }
}

export interface FlowNodeStatsSummary {
  nodeId: string;
  entered: number;
  errors: number;
  outcomes: Record<string, number>;
}

export class GetFlowStatsUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly statRepo: FlowNodeStatRepository,
  ) {}

  async execute(tenantId: string, flowId: string, days: number): Promise<Result<FlowNodeStatsSummary[], DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());

    const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.statRepo.findByFlowId(flowId, fromDate);

    const byNode = new Map<string, FlowNodeStatsSummary>();
    for (const row of rows) {
      const summary = byNode.get(row.nodeId) ?? { nodeId: row.nodeId, entered: 0, errors: 0, outcomes: {} };
      summary.entered += row.entered;
      summary.errors += row.errors;
      for (const [handle, count] of Object.entries(row.outcomes)) {
        summary.outcomes[handle] = (summary.outcomes[handle] ?? 0) + count;
      }
      byNode.set(row.nodeId, summary);
    }
    return ok([...byNode.values()]);
  }
}

export class GetFlowVersionsUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<Result<FlowVersion[], DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    return ok(await this.versionRepo.findByFlowId(flowId));
  }
}

/** Una versión concreta con su grafo, para previsualizarla o restaurarla. */
export class GetFlowVersionUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
  ) {}

  async execute(tenantId: string, flowId: string, versionId: string): Promise<Result<FlowVersion, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());

    const version = await this.versionRepo.findById(versionId);
    // El versionId también se valida contra el flujo: no alcanza con el tenant.
    if (!version || version.flowId !== flowId) return err(new FlowNotFoundError());
    return ok(version);
  }
}
