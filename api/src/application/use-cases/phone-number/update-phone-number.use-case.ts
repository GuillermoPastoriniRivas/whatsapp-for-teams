import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { UpdatePhoneNumberInput } from '../../dtos/phone-number/update-phone-number-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { PhoneNumberNotFoundError, CrossTenantAccessError, DomainError } from '../../../domain/errors/domain-errors.js';

export class UpdatePhoneNumberUseCase {
  constructor(private readonly phoneRepo: PhoneNumberRepository) {}

  async execute(input: UpdatePhoneNumberInput): Promise<Result<PhoneNumber, DomainError>> {
    const existing = await this.phoneRepo.findById(input.id);
    if (!existing) return err(new PhoneNumberNotFoundError());
    if (existing.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    const updated = await this.phoneRepo.update(input.id, {
      label: input.label,
      status: input.status,
      webhookSecret: input.webhookSecret,
      providerConfig: input.providerConfig,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhone: input.displayPhone,
    });

    return ok(updated!);
  }
}
