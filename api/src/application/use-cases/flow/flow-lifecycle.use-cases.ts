// Pausar / reactivar / archivar / regenerar token — operaciones chicas de
// ciclo de vida agrupadas (cada una sigue siendo un use case independiente).

import { randomBytes } from 'node:crypto';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowExecutionRepository } from '../../../domain/repositories/flow-execution.repository.js';
import { Flow } from '../../../domain/entities/flow.entity.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError, FlowInvalidStateError, PlanLimitExceededError } from '../../../domain/errors/domain-errors.js';
import { CheckPlanLimitUseCase } from '../billing/check-plan-limit.use-case.js';

export class PauseFlowUseCase {
  constructor(private readonly flowRepo: FlowRepository) {}

  async execute(tenantId: string, flowId: string): Promise<Result<Flow, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    const updated = await this.flowRepo.transitionStatus(flowId, [FlowStatus.PUBLISHED], FlowStatus.PAUSED);
    if (!updated) return err(new FlowInvalidStateError('Solo se puede pausar un flujo publicado.'));
    return ok(updated);
  }
}

export class ActivateFlowUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly checkPlanLimit: CheckPlanLimitUseCase,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<Result<Flow, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    if (!flow.publishedVersionId) return err(new FlowInvalidStateError('El flujo nunca fue publicado. Publicalo primero.'));

    // El límite cuenta flujos publicados: sin esto se evade pausando uno,
    // publicando otro y reactivando el primero.
    const usage = await this.checkPlanLimit.checkResource(tenantId, 'flows');
    if (!usage.allowed) return err(new PlanLimitExceededError('flows'));
    const updated = await this.flowRepo.transitionStatus(flowId, [FlowStatus.PAUSED], FlowStatus.PUBLISHED);
    if (!updated) return err(new FlowInvalidStateError('Solo se puede reactivar un flujo pausado.'));
    return ok(updated);
  }
}

export class ArchiveFlowUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly execRepo: FlowExecutionRepository,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<Result<void, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    await this.flowRepo.update(flowId, { status: FlowStatus.ARCHIVED });
    // Las ejecuciones vivas se cancelan: un flujo archivado no sigue hablando.
    await this.execRepo.cancelActiveByFlowId(flowId, 'flow_archived');
    return ok(undefined);
  }
}

export class RegenerateWebhookTokenUseCase {
  constructor(private readonly flowRepo: FlowRepository) {}

  async execute(tenantId: string, flowId: string): Promise<Result<{ webhookToken: string }, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    const webhookToken = randomBytes(32).toString('hex');
    await this.flowRepo.update(flowId, { webhookToken });
    return ok({ webhookToken });
  }
}
