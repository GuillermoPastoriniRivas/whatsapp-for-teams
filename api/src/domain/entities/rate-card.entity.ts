// ── La tabla de precios de Meta ──────────────────────────────────
//
// Versionada por fecha de vigencia, y **nunca se edita una card vigente**: se
// crea otra con un `effectiveFrom` posterior. Meta actualiza sus tarifas hasta
// una vez por trimestre; si la tabla se pisara en el lugar, cada recálculo de
// un período viejo daría un número distinto al que se cobró de verdad.
//
// El precio se elige por `deliveredAt` —cuándo se cobró— y no por hoy.

/** Precio de una categoría en un mercado. */
export interface RateEntry {
  /** ISO-2, o `*` para el precio por defecto de los mercados sin fila propia. */
  country: string;
  /** 'marketing' | 'utility' | 'authentication' | 'service' | … */
  category: string;
  /** En la moneda de la card, por mensaje entregado. */
  unitPrice: number;
}

export interface RateCard {
  id: string;
  /** Etiqueta legible: "Meta — vigente desde el 1/10/2026". */
  name: string;
  effectiveFrom: Date;
  /** Null = es la vigente. La cierra la card siguiente. */
  effectiveTo: Date | null;
  currency: string;
  entries: RateEntry[];
  /** De dónde salieron los números, para poder auditarlos. */
  source: string;
  createdAt: Date;
}

/**
 * Busca el precio de una categoría en un mercado, cayendo al comodín `*`.
 *
 * Meta publica tarifas por mercado y agrupa el resto en un precio "otros": sin
 * el comodín, cualquier país fuera de la lista quedaría sin tarifar y el total
 * saldría de menos sin que nadie se entere.
 */
export function findRate(card: RateCard, country: string | null, category: string): RateEntry | null {
  const entries = card.entries;
  if (country) {
    const exact = entries.find((entry) => entry.country === country && entry.category === category);
    if (exact) return exact;
  }
  return entries.find((entry) => entry.country === '*' && entry.category === category) ?? null;
}
