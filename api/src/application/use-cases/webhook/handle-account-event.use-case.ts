import { Logger } from '@nestjs/common';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { PhoneNumber, EMPTY_PHONE_HEALTH, PhoneNumberHealth } from '../../../domain/entities/phone-number.entity.js';
import { PhoneNumberStatus } from '../../../domain/enums/phone-number-status.enum.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { AccountEventInput } from '../../dtos/webhook/account-event-input.dto.js';

/** Estados de baneo de Meta que dejan el número sin poder mandar nada. */
const DISABLING_BAN_STATES = new Set(['DISABLED', 'BANNED', 'SCHEDULED_FOR_DISABLE']);

/**
 * Salud de la cuenta y del número: baneos, violaciones de política, caídas de
 * calidad y verificación del nombre.
 *
 * Hasta ago-2026 asis no escuchaba ninguno de estos campos, así que un número
 * degradado o suspendido seguía figurando como activo y el primero en enterarse
 * era el cliente cuando le fallaban las campañas.
 *
 * Los eventos llegan a nivel WABA. Cuando traen `display_phone_number` aplican a
 * ese número; si no, a todos los de la WABA.
 */
export class HandleAccountEventUseCase {
  private readonly logger = new Logger(HandleAccountEventUseCase.name);

  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: AccountEventInput): Promise<void> {
    const phones = await this.targets(input);
    if (phones.length === 0) {
      // Puede pasar legítimamente: eventos de una WABA que todavía no
      // onboardeamos. No es un error, pero conviene verlo.
      this.logger.warn(`Evento ${input.field} de la WABA ${input.wabaId}: no hay números nuestros`);
      return;
    }

    const patch = this.healthPatch(input);
    const disable = this.shouldDisable(input);

    for (const phone of phones) {
      const health: PhoneNumberHealth = {
        ...(phone.health ?? EMPTY_PHONE_HEALTH),
        ...patch,
        updatedAt: new Date(),
      };

      await this.phoneRepo.update(phone.id, {
        health,
        ...(disable ? { status: PhoneNumberStatus.INACTIVE } : {}),
      });

      if (disable) {
        this.logger.error(
          `Número ${phone.displayPhone} desactivado: Meta reportó ${health.accountStatus ?? input.field}`,
        );
      }

      // La pantalla de números escucha esto para repintar sin refrescar.
      this.gateway.emitToTenant(phone.tenantId, 'phone-number.updated', {
        phoneNumberId: phone.id,
        field: input.field,
        health,
      });
    }
  }

  /** A qué números aplica el evento. */
  private async targets(input: AccountEventInput): Promise<PhoneNumber[]> {
    const all = await this.phoneRepo.findAllByWabaId(input.wabaId);
    if (!input.displayPhoneNumber) return all;

    // Meta manda el número con formato humano; nosotros lo guardamos con y sin
    // '+' según de dónde vino, así que se compara por dígitos.
    const wanted = input.displayPhoneNumber;
    const match = all.filter((phone) => phone.displayPhone.replace(/\D/g, '') === wanted);
    return match.length > 0 ? match : all;
  }

  private healthPatch(input: AccountEventInput): Partial<PhoneNumberHealth> {
    const value = input.value as Record<string, any>;

    switch (input.field) {
      case 'phone_number_quality_update':
        return {
          qualityRating: typeof value.event === 'string' ? value.event : null,
          throughputLevel: typeof value.current_limit === 'string' ? value.current_limit : null,
        };

      case 'phone_number_name_update':
        return { nameStatus: typeof value.decision === 'string' ? value.decision : null };

      case 'account_update':
        return { accountStatus: this.accountStatusOf(value) };

      // El resto (alerts, review, capability, componentes de plantilla) no
      // cambia la salud del número: se registra y se emite, nada más.
      default:
        return {};
    }
  }

  private accountStatusOf(value: Record<string, any>): string | null {
    if (typeof value.ban_info?.waba_ban_state === 'string') return value.ban_info.waba_ban_state;
    if (typeof value.violation_info?.violation_type === 'string') {
      return `VIOLATION:${value.violation_info.violation_type}`;
    }
    if (Array.isArray(value.restriction_info) && value.restriction_info.length > 0) {
      const types = value.restriction_info
        .map((r: any) => r?.restriction_type)
        .filter((t: unknown): t is string => typeof t === 'string');
      if (types.length > 0) return `RESTRICTED:${types.join(',')}`;
    }
    if (typeof value.event === 'string') return value.event;
    return null;
  }

  /**
   * Solo el baneo desactiva el número. Una violación o una restricción se
   * registran pero no cortan: el negocio puede seguir contestando conversaciones
   * abiertas mientras resuelve con Meta.
   */
  private shouldDisable(input: AccountEventInput): boolean {
    if (input.field !== 'account_update') return false;
    const state = (input.value as Record<string, any>)?.ban_info?.waba_ban_state;
    return typeof state === 'string' && DISABLING_BAN_STATES.has(state.toUpperCase());
  }
}
