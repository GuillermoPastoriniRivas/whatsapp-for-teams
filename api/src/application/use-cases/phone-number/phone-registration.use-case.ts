import { Logger } from '@nestjs/common';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { EMPTY_PHONE_HEALTH, PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { PhoneAdminPort, RemotePhoneNumberInfo } from '../../ports/phone-admin.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  CrossTenantAccessError,
  PhoneRegistrationProviderError,
} from '../../../domain/errors/domain-errors.js';

const PIN_PATTERN = /^\d{6}$/;
const VERIFICATION_CODE_PATTERN = /^\d{4,8}$/;

function providerRejection(error: unknown): PhoneRegistrationProviderError {
  const detail = error instanceof Error ? error.message : String(error);
  return new PhoneRegistrationProviderError(detail);
}

/**
 * Sincroniza contra Meta lo que sabemos del número: nombre verificado, calidad,
 * verificación y throughput.
 *
 * Hasta ago-2026 dar de alta un número era un insert en Mongo y nada más: nunca
 * le preguntábamos a Meta si el número existía, estaba verificado o registrado.
 */
export class SyncPhoneNumberUseCase {
  private readonly logger = new Logger(SyncPhoneNumberUseCase.name);

  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
  ) {}

  async execute(tenantId: string, phoneId: string): Promise<Result<PhoneNumber, DomainError>> {
    const phone = await this.phoneRepo.findById(phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== tenantId) return err(new CrossTenantAccessError());

    let info: RemotePhoneNumberInfo | null;
    try {
      info = await this.admin.getPhoneNumberInfo({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
      });
    } catch (error: unknown) {
      return err(providerRejection(error));
    }
    if (!info) return ok(phone);

    const updated = await this.phoneRepo.update(phone.id, {
      // El nombre para mostrar lo decide Meta, no nosotros.
      ...(info.displayPhoneNumber ? { displayPhone: info.displayPhoneNumber } : {}),
      health: {
        ...(phone.health ?? EMPTY_PHONE_HEALTH),
        qualityRating: info.qualityRating,
        throughputLevel: info.throughputLevel,
        nameStatus: info.codeVerificationStatus,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Número ${phone.displayPhone} sincronizado: calidad ${info.qualityRating ?? '—'}, ` +
        `${info.registered ? 'registrado' : 'SIN registrar'}`,
    );

    return ok(updated ?? phone);
  }
}

export interface RegisterOnMetaInput {
  tenantId: string;
  phoneId: string;
  /** PIN de verificación en dos pasos, 6 dígitos. */
  pin: string;
}

/**
 * Registra el número en Cloud API. Sin esto el número **no manda nada**, por más
 * que las credenciales sean correctas — es el paso que faltaba en el alta.
 *
 * Si el número ya tenía un PIN de 2FA configurado hay que mandar ese mismo; uno
 * nuevo lo rechaza Meta con 133005.
 */
export class RegisterPhoneNumberOnMetaUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
    private readonly sync: SyncPhoneNumberUseCase,
  ) {}

  async execute(input: RegisterOnMetaInput): Promise<Result<PhoneNumber, DomainError>> {
    if (!PIN_PATTERN.test(input.pin)) {
      return err(new DomainError('INVALID_PIN', 'El PIN de verificación en dos pasos son 6 dígitos.'));
    }

    const phone = await this.phoneRepo.findById(input.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    try {
      await this.admin.register(
        {
          provider: phone.provider,
          providerConfig: phone.providerConfig,
          phoneNumberId: phone.phoneNumberId,
        },
        input.pin,
      );
    } catch (error: unknown) {
      return err(providerRejection(error));
    }

    // Tras registrar, Meta ya reporta calidad y verificación: se refresca para
    // que la pantalla muestre el estado real y no el de antes del alta.
    const synced = await this.sync.execute(input.tenantId, input.phoneId);
    return synced.ok ? synced : ok(phone);
  }
}

export type VerificationCodeMethod = 'SMS' | 'VOICE';

export interface RequestVerificationCodeInput {
  tenantId: string;
  phoneId: string;
  method: VerificationCodeMethod;
  locale: string;
}

export interface VerificationCodeSent {
  sent: true;
  method: VerificationCodeMethod;
}

export class RequestPhoneVerificationCodeUseCase {
  private readonly logger = new Logger(RequestPhoneVerificationCodeUseCase.name);

  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
  ) {}

  async execute(input: RequestVerificationCodeInput): Promise<Result<VerificationCodeSent, DomainError>> {
    const phone = await this.phoneRepo.findById(input.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    try {
      await this.admin.requestVerificationCode(
        {
          provider: phone.provider,
          providerConfig: phone.providerConfig,
          phoneNumberId: phone.phoneNumberId,
        },
        input.method,
        input.locale,
      );
    } catch (error: unknown) {
      return err(providerRejection(error));
    }

    this.logger.log(`Código de verificación pedido para ${phone.displayPhone} por ${input.method}`);

    return ok({ sent: true, method: input.method });
  }
}

export interface VerifyCodeInput {
  tenantId: string;
  phoneId: string;
  code: string;
}

export class VerifyPhoneNumberCodeUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
    private readonly sync: SyncPhoneNumberUseCase,
  ) {}

  async execute(input: VerifyCodeInput): Promise<Result<PhoneNumber, DomainError>> {
    if (!VERIFICATION_CODE_PATTERN.test(input.code)) {
      return err(new DomainError('INVALID_VERIFICATION_CODE', 'El código de verificación son los dígitos que mandó Meta, sin espacios ni guiones.'));
    }

    const phone = await this.phoneRepo.findById(input.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    try {
      await this.admin.verifyCode(
        {
          provider: phone.provider,
          providerConfig: phone.providerConfig,
          phoneNumberId: phone.phoneNumberId,
        },
        input.code,
      );
    } catch (error: unknown) {
      return err(providerRejection(error));
    }

    const synced = await this.sync.execute(input.tenantId, input.phoneId);
    return synced.ok ? synced : ok(phone);
  }
}
