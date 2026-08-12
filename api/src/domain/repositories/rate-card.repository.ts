import type { RateCard } from '../entities/rate-card.entity.js';

export type CreateRateCardInput = Omit<RateCard, 'id' | 'createdAt'>;

export interface RateCardRepository {
  /**
   * La card que estaba vigente en ese instante. Se busca por la fecha de
   * entrega del mensaje, no por hoy: si no, recalcular un período viejo
   * devuelve el precio de ahora y el número deja de cerrar con lo cobrado.
   */
  findEffectiveAt(at: Date): Promise<RateCard | null>;
  findById(id: string): Promise<RateCard | null>;
  list(): Promise<RateCard[]>;
  create(input: CreateRateCardInput): Promise<RateCard>;
}
