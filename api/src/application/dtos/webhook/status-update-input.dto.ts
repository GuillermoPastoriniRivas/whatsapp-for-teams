import type { MetaPricingSnapshot } from '../../../domain/value-objects/meta-pricing.js';

export interface StatusUpdateInput {
  waMessageId: string;
  status: string;
  timestamp: Date;
  errors?: Array<{ code: number; title: string }>;
  /**
   * Qué cobró Meta por este mensaje. Viene sólo en `delivered` y no se repite:
   * si no se persiste cuando llega, no hay forma de recuperarlo.
   */
  pricing?: MetaPricingSnapshot | null;
}
