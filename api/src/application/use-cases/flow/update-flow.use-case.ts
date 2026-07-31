import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import { Flow, FlowGraph } from '../../../domain/entities/flow.entity.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError, FlowInvalidStateError } from '../../../domain/errors/domain-errors.js';

export interface UpdateFlowInputDto {
  tenantId: string;
  flowId: string;
  name?: string;
  description?: string | null;
  draftGraph?: FlowGraph;
  priority?: number;
}

export class UpdateFlowUseCase {
  constructor(private readonly flowRepo: FlowRepository) {}

  async execute(input: UpdateFlowInputDto): Promise<Result<Flow, DomainError>> {
    const flow = await this.flowRepo.findById(input.flowId);
    if (!flow || flow.tenantId !== input.tenantId) return err(new FlowNotFoundError());
    if (flow.status === FlowStatus.ARCHIVED) return err(new FlowInvalidStateError('El flujo está archivado.'));

    const updated = await this.flowRepo.update(input.flowId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.draftGraph !== undefined ? { draftGraph: input.draftGraph } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    });
    return ok(updated!);
  }
}
