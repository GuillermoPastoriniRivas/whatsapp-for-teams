import { Logger } from '@nestjs/common';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import type { FlowCatalogPort, WhatsAppFlowSummary } from '../../ports/flow-catalog.port.js';

export interface WhatsAppFlowOption extends WhatsAppFlowSummary {
  /** Desde qué número se puede mandar: un Flow vive en su WABA. */
  phoneNumberId: string;
  phoneLabel: string;
}

/**
 * Los formularios que el negocio ya armó en WhatsApp Manager. Se leen en vivo
 * de Meta y no se copian a nuestra base: publicar o cambiar uno pasa allá, y
 * una copia nuestra envejecería sin que nadie se entere.
 */
export class ListWhatsAppFlowsUseCase {
  private readonly logger = new Logger(ListWhatsAppFlowsUseCase.name);

  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly catalog: FlowCatalogPort,
  ) {}

  async execute(tenantId: string): Promise<WhatsAppFlowOption[]> {
    const phones = (await this.phoneRepo.findByTenantId(tenantId)).filter((phone) => phone.wabaId);

    // Varios números pueden compartir WABA: se consulta una vez por WABA.
    const vistas = new Set<string>();
    const options: WhatsAppFlowOption[] = [];

    for (const phone of phones) {
      if (vistas.has(phone.wabaId)) continue;
      vistas.add(phone.wabaId);

      try {
        const flows = await this.catalog.listFlows({
          provider: phone.provider,
          providerConfig: phone.providerConfig,
          wabaId: phone.wabaId,
        });
        for (const flow of flows) {
          options.push({ ...flow, phoneNumberId: phone.id, phoneLabel: phone.label || phone.displayPhone });
        }
      } catch (error: any) {
        // Que una WABA no responda no puede dejar sin lista a las demás.
        this.logger.warn(`No se pudieron leer los formularios de la WABA ${phone.wabaId}: ${error?.message}`);
      }
    }

    return options;
  }
}
