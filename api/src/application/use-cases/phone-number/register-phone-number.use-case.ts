import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { RegisterPhoneNumberInput } from '../../dtos/phone-number/register-phone-number-input.dto.js';
import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';
import { Result, ok } from '../../common/result.js';

export class RegisterPhoneNumberUseCase {
  constructor(private readonly phoneRepo: PhoneNumberRepository) {}

  async execute(input: RegisterPhoneNumberInput): Promise<Result<PhoneNumber, never>> {
    const phone = await this.phoneRepo.create({
      tenantId: input.tenantId,
      provider: input.provider,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhone: input.displayPhone,
      label: input.label,
      webhookSecret: input.webhookSecret,
      status: PhoneNumberStatus.ACTIVE,
    });

    return ok(phone);
  }
}
