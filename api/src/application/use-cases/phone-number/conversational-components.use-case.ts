import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { PhoneAdminPort, ConversationalComponents } from '../../ports/phone-admin.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  CrossTenantAccessError,
} from '../../../domain/errors/domain-errors.js';

// Topes de Meta. Se validan acá para no gastar el viaje a la API y para poder
// devolver un mensaje que diga cuál se pasó.
const MAX_ICE_BREAKERS = 4;
const MAX_ICE_BREAKER_LENGTH = 80;
const MAX_COMMANDS = 30;
const MAX_COMMAND_NAME = 32;
const MAX_COMMAND_DESCRIPTION = 256;

/** Ni los ice breakers ni los comandos aceptan emojis. */
const EMOJI = /\p{Extended_Pictographic}/u;

const EMPTY: ConversationalComponents = { enabled: false, iceBreakers: [], commands: [] };

export class GetConversationalComponentsUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
  ) {}

  async execute(tenantId: string, phoneId: string): Promise<Result<ConversationalComponents, DomainError>> {
    const phone = await this.phoneRepo.findById(phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== tenantId) return err(new CrossTenantAccessError());

    const components = await this.admin.getConversationalComponents({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
    });

    // Un número sin nada configurado devuelve el objeto vacío, no un error: la
    // pantalla tiene que poder abrirse para configurarlo por primera vez.
    return ok(components ?? EMPTY);
  }
}

export class UpdateConversationalComponentsUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly admin: PhoneAdminPort,
  ) {}

  async execute(
    tenantId: string,
    phoneId: string,
    components: ConversationalComponents,
  ): Promise<Result<ConversationalComponents, DomainError>> {
    const phone = await this.phoneRepo.findById(phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== tenantId) return err(new CrossTenantAccessError());

    const invalid = this.validate(components);
    if (invalid) return err(invalid);

    await this.admin.updateConversationalComponents(
      {
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
      },
      components,
    );

    return ok(components);
  }

  private validate(components: ConversationalComponents): DomainError | null {
    const iceBreakers = components.iceBreakers.filter((text) => text.trim().length > 0);
    if (iceBreakers.length > MAX_ICE_BREAKERS) {
      return new DomainError('INVALID_COMPONENTS', `WhatsApp admite hasta ${MAX_ICE_BREAKERS} accesos rápidos.`);
    }
    for (const text of iceBreakers) {
      if (text.length > MAX_ICE_BREAKER_LENGTH) {
        return new DomainError('INVALID_COMPONENTS', `Cada acceso rápido admite ${MAX_ICE_BREAKER_LENGTH} caracteres.`);
      }
      if (EMOJI.test(text)) {
        return new DomainError('INVALID_COMPONENTS', 'Los accesos rápidos no admiten emojis.');
      }
    }

    if (components.commands.length > MAX_COMMANDS) {
      return new DomainError('INVALID_COMPONENTS', `WhatsApp admite hasta ${MAX_COMMANDS} comandos.`);
    }
    for (const command of components.commands) {
      if (!command.commandName.trim() || !command.commandDescription.trim()) {
        return new DomainError('INVALID_COMPONENTS', 'Cada comando necesita nombre y descripción.');
      }
      if (command.commandName.length > MAX_COMMAND_NAME) {
        return new DomainError('INVALID_COMPONENTS', `El nombre del comando admite ${MAX_COMMAND_NAME} caracteres.`);
      }
      if (command.commandDescription.length > MAX_COMMAND_DESCRIPTION) {
        return new DomainError('INVALID_COMPONENTS', `La descripción admite ${MAX_COMMAND_DESCRIPTION} caracteres.`);
      }
      if (EMOJI.test(command.commandName) || EMOJI.test(command.commandDescription)) {
        return new DomainError('INVALID_COMPONENTS', 'Los comandos no admiten emojis.');
      }
    }

    return null;
  }
}
