import type { RateEntry } from '../entities/rate-card.entity.js';

// ── Tarifas publicadas por Meta ──────────────────────────────────
//
// Punto de partida para sembrar la primera rate card. **No es la fuente de
// verdad**: Meta actualiza hasta una vez por trimestre y publica las de octubre
// de 2026 recién el 1 de septiembre. Cuando salgan, se carga una card nueva con
// su `effectiveFrom` — no se edita ésta.
//
// Precios en USD por mensaje entregado. La fila `*` es el precio de los
// mercados sin fila propia: sin ella, un país fuera de la lista queda sin
// tarifar y el total sale de menos sin que nadie se entere.
//
// Los dos hitos de 2026 que cambian todo:
//   - 1/8/2026 — Meta Business Agent se cobra por token. No lo usamos.
//   - 1/10/2026 — todo mensaje NO-plantilla pasa a cobrarse (categoría
//     `service`), a la misma tarifa que utility, y sin tramos por volumen. Es
//     el cambio que convierte cada burbuja en un cargo.

/** Un mercado con sus cuatro precios. `service` = utility, por definición de Meta. */
function market(country: string, marketing: number, utility: number, authentication: number): RateEntry[] {
  return [
    { country, category: 'marketing', unitPrice: marketing },
    { country, category: 'utility', unitPrice: utility },
    { country, category: 'authentication', unitPrice: authentication },
    // Meta lo dijo explícito: la tarifa de service es la misma que la de
    // utility y authentication en cada mercado.
    { country, category: 'service', unitPrice: utility },
  ];
}

/**
 * Semilla de los mercados grandes de WhatsApp. Los números son de orden de
 * magnitud correcto pero **hay que confirmarlos contra el rate card oficial**
 * antes de mostrarle plata a un cliente: se cargan acá para que el sistema
 * arranque calculando, no para creerles.
 */
export const SEED_RATE_ENTRIES: RateEntry[] = [
  ...market('AR', 0.0618, 0.034, 0.0367),
  ...market('BR', 0.0625, 0.008, 0.0315),
  ...market('MX', 0.0436, 0.0091, 0.0239),
  ...market('CO', 0.0125, 0.0028, 0.0077),
  ...market('CL', 0.0889, 0.0316, 0.0454),
  ...market('PE', 0.0703, 0.0154, 0.0409),
  ...market('IN', 0.0107, 0.0014, 0.0014),
  ...market('ID', 0.0411, 0.02, 0.0292),
  ...market('ES', 0.0615, 0.0293, 0.0342),
  ...market('GB', 0.0529, 0.0296, 0.0358),
  ...market('DE', 0.0768, 0.0333, 0.0389),
  ...market('IT', 0.0691, 0.0301, 0.0357),
  ...market('US', 0.025, 0.004, 0.0135),
  ...market('ZA', 0.0379, 0.0068, 0.0196),
  ...market('NG', 0.0537, 0.0071, 0.0304),
  // Resto del mundo. Meta agrupa así los mercados sin tarifa propia.
  ...market('*', 0.0604, 0.0184, 0.0331),
];
