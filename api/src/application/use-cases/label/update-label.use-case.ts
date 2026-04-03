import { Label } from '../../../domain/entities/label.entity.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { LabelNotFoundError, DuplicateLabelNameError } from '../../../domain/errors/domain-errors.js';

export interface UpdateLabelInput {
  labelId: string;
  tenantId: string;
  name?: string;
  color?: string;
}

export class UpdateLabelUseCase {
  constructor(private readonly labelRepo: LabelRepository) {}

  async execute(input: UpdateLabelInput): Promise<Result<Label, LabelNotFoundError | DuplicateLabelNameError>> {
    const label = await this.labelRepo.findById(input.labelId);
    if (!label || label.tenantId !== input.tenantId) return err(new LabelNotFoundError());

    if (input.name && input.name !== label.name) {
      const existing = await this.labelRepo.findByTenantIdAndName(input.tenantId, input.name);
      if (existing) return err(new DuplicateLabelNameError());
    }

    const updated = await this.labelRepo.update(input.labelId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
    });

    return ok(updated!);
  }
}
