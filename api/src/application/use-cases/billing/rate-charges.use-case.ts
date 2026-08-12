import { Logger } from '@nestjs/common';
import type { MessageChargeRepository } from '../../../domain/repositories/message-charge.repository.js';
import type { RateCardRepository } from '../../../domain/repositories/rate-card.repository.js';
import { findRate, type RateCard } from '../../../domain/entities/rate-card.entity.js';
import { billingCategoryOf, isBillable, type MessageCharge } from '../../../domain/entities/message-charge.entity.js';

const BATCH_SIZE = 500;

export interface RateChargesResult {
  processed: number;
  rated: number;
  /** Entregados que no se pudieron tarifar por falta de precio. */
  missingRate: number;
  /** Casos en que Meta cobró una categoría distinta a la que estimamos. */
  categoryMismatches: number;
}

/**
 * Le pone precio a lo que ya se entregó.
 *
 * Corre aparte del webhook a propósito: el precio depende de una rate card que
 * puede cargarse después —Meta publica las tarifas de octubre recién el 1 de
 * septiembre— y de la categoría que Meta informa al entregar. Tarifar en
 * caliente obligaría a tener todo cargado antes de que llegue el primer
 * mensaje, y a no poder recalcular nunca.
 *
 * Recordatorio de por qué esto es sólo informativo: asis **no cobra los
 * mensajes**. Meta le factura al cliente directo; lo que se calcula acá es para
 * que el cliente vea en qué se le va la plata, no para emitir una factura.
 */
export class RateChargesUseCase {
  private readonly logger = new Logger(RateChargesUseCase.name);

  constructor(
    private readonly charges: MessageChargeRepository,
    private readonly cards: RateCardRepository,
  ) {}

  async execute(limit = BATCH_SIZE): Promise<RateChargesResult> {
    const pending = await this.charges.findUnrated(limit);
    const result: RateChargesResult = { processed: pending.length, rated: 0, missingRate: 0, categoryMismatches: 0 };

    // Una card por fecha, cacheada por corrida: un lote suele caer todo en el
    // mismo día y no tiene sentido ir a la base por cada fila.
    const cardCache = new Map<string, RateCard | null>();

    for (const charge of pending) {
      const deliveredAt = charge.deliveredAt;
      if (!deliveredAt) continue;

      if (charge.meta?.category && charge.meta.category !== charge.estimatedCategory) {
        result.categoryMismatches += 1;
      }

      const card = await this.cardFor(deliveredAt, cardCache);
      if (!card) {
        result.missingRate += 1;
        continue;
      }

      const rated = this.rate(charge, card);
      if (!rated) {
        result.missingRate += 1;
        continue;
      }

      await this.charges.setRate(charge.id, rated);
      result.rated += 1;
    }

    if (result.missingRate > 0) {
      // Que se vea. Un total que sale de menos porque faltaba una tarifa es
      // indistinguible de un total correcto si nadie lo dice.
      this.logger.warn(
        `${result.missingRate} de ${result.processed} entregados quedaron sin tarifar: falta rate card o falta la fila del mercado`,
      );
    }
    if (result.categoryMismatches > 0) {
      this.logger.warn(
        `${result.categoryMismatches} mensajes se cobraron con una categoría distinta a la que estimamos — revisar la estimación`,
      );
    }

    return result;
  }

  private async cardFor(at: Date, cache: Map<string, RateCard | null>): Promise<RateCard | null> {
    const key = at.toISOString().slice(0, 10);
    if (!cache.has(key)) cache.set(key, await this.cards.findEffectiveAt(at));
    return cache.get(key) ?? null;
  }

  private rate(charge: MessageCharge, card: RateCard) {
    // La categoría de Meta le gana a la nuestra: es la que emite la factura.
    const category = billingCategoryOf(charge);
    const entry = findRate(card, charge.destinationCountry, category);
    if (!entry) return null;

    const billable = isBillable(charge);
    return {
      rateCardId: card.id,
      currency: card.currency,
      unitPrice: entry.unitPrice,
      // Se guarda la fila igual con importe 0 cuando no se cobra: así "gratis"
      // y "sin tarifar" siguen siendo distinguibles.
      amount: billable ? entry.unitPrice : 0,
      appliedCategory: category,
      computedAt: new Date(),
    };
  }
}
