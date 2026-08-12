import { Logger } from '@nestjs/common';
import type { MessageChargeRepository } from '../../../domain/repositories/message-charge.repository.js';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import type { WhatsAppAnalyticsPort } from '../../ports/whatsapp-analytics.port.js';

export interface ReconciliationRow {
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  from: Date;
  to: Date;
  /** Lo que contamos nosotros como entregado. */
  ours: number;
  /** Lo que reporta Meta como entregado para la misma WABA y período. */
  meta: number | null;
  delta: number | null;
}

/**
 * Compara nuestro libro contra los números de Meta.
 *
 * El delta tiene que ser visible: un webhook perdido o un envío no
 * contabilizado no avisa solo, y el primero en enterarse no puede ser el
 * cliente cuando le llega la factura de Meta con un número que no coincide con
 * lo que le mostramos.
 *
 * Cada tenant tiene su propia WABA (`PhoneNumber.tenantId` + `wabaId` + sus
 * credenciales), así que la comparación es uno a uno y no hay que prorratear
 * nada entre cuentas.
 */
export class ReconcileMetaUsageUseCase {
  private readonly logger = new Logger(ReconcileMetaUsageUseCase.name);

  constructor(
    private readonly charges: MessageChargeRepository,
    private readonly phones: PhoneNumberRepository,
    private readonly analytics: WhatsAppAnalyticsPort,
  ) {}

  async execute(tenantId: string, from: Date, to: Date): Promise<ReconciliationRow[]> {
    const phones = await this.phones.findByTenantId(tenantId);
    const rows: ReconciliationRow[] = [];

    for (const phone of phones) {
      if (!phone.wabaId) continue;

      const ours = await this.charges.countDelivered(tenantId, from, to);

      let meta: number | null = null;
      try {
        const points = await this.analytics.getMessagingAnalytics(
          { provider: phone.provider, providerConfig: phone.providerConfig, wabaId: phone.wabaId },
          { start: from, end: to, granularity: 'DAY', phoneNumberIds: [phone.phoneNumberId] },
        );
        meta = points.reduce((sum, point) => sum + point.delivered, 0);
      } catch (error) {
        // Que Meta no conteste no puede tumbar el reporte: se informa el hueco.
        this.logger.warn(`No se pudo leer analytics de la WABA ${phone.wabaId}: ${(error as Error)?.message}`);
      }

      const delta = meta === null ? null : ours - meta;
      if (delta !== null && delta !== 0) {
        this.logger.warn(
          `Descuadre en ${phone.displayPhone}: nosotros contamos ${ours} entregados, Meta ${meta} (delta ${delta})`,
        );
      }

      rows.push({ tenantId, phoneNumberId: phone.id, wabaId: phone.wabaId, from, to, ours, meta, delta });
    }

    return rows;
  }
}
