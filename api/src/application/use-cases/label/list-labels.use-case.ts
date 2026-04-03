import { Label } from '../../../domain/entities/label.entity.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';

export class ListLabelsUseCase {
  constructor(private readonly labelRepo: LabelRepository) {}

  async execute(tenantId: string): Promise<Label[]> {
    return this.labelRepo.findByTenantId(tenantId);
  }
}
