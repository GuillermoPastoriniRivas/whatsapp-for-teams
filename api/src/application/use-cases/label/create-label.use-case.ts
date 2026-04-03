import { Label } from '../../../domain/entities/label.entity.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DuplicateLabelNameError } from '../../../domain/errors/domain-errors.js';

export interface CreateLabelInput {
  tenantId: string;
  name: string;
  color: string;
}

export class CreateLabelUseCase {
  constructor(private readonly labelRepo: LabelRepository) {}

  async execute(input: CreateLabelInput): Promise<Result<Label, DuplicateLabelNameError>> {
    const existing = await this.labelRepo.findByTenantIdAndName(input.tenantId, input.name);
    if (existing) return err(new DuplicateLabelNameError());

    const label = await this.labelRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      color: input.color,
    });

    return ok(label);
  }
}
