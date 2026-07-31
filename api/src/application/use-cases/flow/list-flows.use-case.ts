import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import { Flow } from '../../../domain/entities/flow.entity.js';

export class ListFlowsUseCase {
  constructor(private readonly flowRepo: FlowRepository) {}

  async execute(tenantId: string): Promise<Flow[]> {
    return this.flowRepo.findByTenantId(tenantId);
  }
}
