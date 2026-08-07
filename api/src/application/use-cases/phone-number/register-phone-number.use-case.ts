import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { RegisterPhoneNumberInput } from '../../dtos/phone-number/register-phone-number-input.dto.js';
import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';
import { Result, ok } from '../../common/result.js';
import { Logger } from '@nestjs/common';
import { EnsureDefaultPhoneFlowUseCase } from '../flow/ensure-default-phone-flow.use-case.js';

export class RegisterPhoneNumberUseCase {
  private readonly logger = new Logger(RegisterPhoneNumberUseCase.name);

  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly ensureDefaultFlow: EnsureDefaultPhoneFlowUseCase,
  ) {}

  async execute(input: RegisterPhoneNumberInput): Promise<Result<PhoneNumber, never>> {
    const phone = await this.phoneRepo.create({
      tenantId: input.tenantId,
      provider: input.provider,
      providerConfig: input.providerConfig,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhone: input.displayPhone,
      label: input.label,
      webhookSecret: input.webhookSecret,
      status: PhoneNumberStatus.ACTIVE,
      portfolioId: input.portfolioId?.trim() || null,
    });

    // El número nace con su automatización base: es la que decide quién
    // atiende. Si falla, el número igual queda dado de alta — el router
    // reparte al equipo por su cuenta y el script de migración la crea después.
    try {
      await this.ensureDefaultFlow.execute({
        tenantId: phone.tenantId,
        phoneNumberId: phone.id,
        phoneLabel: phone.label || phone.displayPhone,
      });
    } catch (error: any) {
      this.logger.error(`No se pudo crear la automatización base de ${phone.id}: ${error?.message}`);
    }

    return ok(phone);
  }
}
