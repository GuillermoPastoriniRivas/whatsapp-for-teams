import { Logger } from '@nestjs/common';
import { ContactMergeRepository, ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { UserIdUpdateInput } from '../../dtos/webhook/inbound-message-input.dto.js';

/**
 * Meta regenera el BSUID cuando el usuario cambia de número, y avisa por el
 * webhook `user_id_update` con el valor viejo y el nuevo. Sin este handler, el
 * próximo mensaje de esa persona entraría como contacto nuevo y se perdería
 * todo el historial.
 *
 * Es idempotente: Meta reentrega webhooks, así que si el BSUID viejo ya no
 * existe simplemente no hay nada que hacer.
 */
export class HandleUserIdUpdateUseCase {
  private readonly logger = new Logger(HandleUserIdUpdateUseCase.name);

  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly contactRepo: ContactRepository,
    private readonly mergeRepo: ContactMergeRepository,
  ) {}

  async execute(input: UserIdUpdateInput): Promise<void> {
    const phone = await this.phoneRepo.findByWabaId(input.wabaId);
    if (!phone) {
      this.logger.warn(`user_id_update para una WABA desconocida: ${input.wabaId}`);
      return;
    }

    const { tenantId } = phone;
    const scope = phone.bsuidScope;

    const existing = await this.contactRepo.findByBsuid(tenantId, scope, input.previousBsuid);
    if (!existing) return; // ya migrado, o nunca lo vimos

    // El BSUID nuevo puede existir ya como otro contacto (la persona escribió
    // desde el número nuevo antes de que llegara este webhook).
    const collision = await this.contactRepo.findByBsuid(tenantId, scope, input.newBsuid);

    let targetId = existing.id;
    if (collision && collision.id !== existing.id) {
      const [survivor, duplicate] =
        existing.createdAt <= collision.createdAt ? [existing, collision] : [collision, existing];
      await this.mergeRepo.merge(survivor.id, duplicate.id);
      targetId = survivor.id;
    }

    // Si el webhook trae el número nuevo se pisa el viejo. Si no, el guardado
    // queda como está: puede haber quedado desactualizado, pero el teléfono es
    // el identificador de recuperación cuando los BSUID se invalidan (por
    // ejemplo, si el negocio re-registra su WABA), y perderlo es peor que
    // tenerlo viejo.
    await this.contactRepo.applyIdentity(
      targetId,
      { bsuid: input.newBsuid, portfolioId: scope, phone: input.phone },
      {},
    );

    this.logger.log(`BSUID actualizado: ${input.previousBsuid} → ${input.newBsuid}`);
  }
}
