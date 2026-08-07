import { Logger } from '@nestjs/common';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { UserPreferenceInput } from '../../dtos/webhook/account-event-input.dto.js';

/**
 * Opt-out de marketing declarado por el usuario en WhatsApp.
 *
 * No es una preferencia que administremos nosotros: la decide la persona desde
 * su teléfono, y seguir mandándole campañas quema la calidad del número y
 * termina en suspensión de la cuenta. Por eso se persiste en el contacto y las
 * campañas lo consultan antes de encolar.
 */
export class HandleUserPreferenceUseCase {
  private readonly logger = new Logger(HandleUserPreferenceUseCase.name);

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: UserPreferenceInput): Promise<void> {
    // El evento llega a nivel WABA: el tenant sale del número.
    const phone = await this.phoneRepo.findByWabaId(input.wabaId);
    if (!phone) {
      this.logger.warn(`Preferencia de marketing de la WABA ${input.wabaId}: no hay números nuestros`);
      return;
    }

    const contact = await this.contactRepo.setMarketingOptOut(
      phone.tenantId,
      { phone: input.phone, bsuid: input.bsuid, portfolioId: phone.bsuidScope },
      input.optedOut ? input.timestamp : null,
    );

    if (!contact) {
      // Puede pasar: alguien que nunca nos escribió puede tener la preferencia
      // seteada. No hay nada que guardar todavía.
      this.logger.debug(`Preferencia de marketing sin contacto conocido (waba ${input.wabaId})`);
      return;
    }

    this.logger.log(
      `${contact.displayName} ${input.optedOut ? 'se dio de baja de' : 'reactivó'} los mensajes de marketing`,
    );

    this.gateway.emitToTenant(phone.tenantId, 'contact.updated', { contactId: contact.id });
  }
}
