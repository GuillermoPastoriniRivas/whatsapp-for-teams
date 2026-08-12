// ── Lo que Meta dice que cobró ───────────────────────────────────
//
// Nosotros estimamos la categoría en el momento del envío; Meta la decide al
// entregar. Cuando las dos no coinciden, la de Meta es la que sale en la
// factura — y la discrepancia es un bug nuestro que hay que poder ver.
//
// Llega pegada al status `delivered` y no se repite en `read`.

/** Categorías tarifadas. `service` y `meta_business_agent` son de julio 2026. */
export type MetaPricingCategory =
  | 'marketing'
  | 'utility'
  | 'authentication'
  | 'authentication_international'
  | 'service'
  | 'meta_business_agent'
  | 'referral_conversion';

/**
 * Snapshot del objeto `pricing` del webhook, más el `conversation` del modelo
 * viejo por conversación.
 *
 * `raw` guarda el objeto tal cual vino: Meta agrega valores sin avisar y el
 * detalle de Meta Business Agent todavía no está publicado. Sin el crudo, un
 * campo nuevo se pierde en silencio y no hay forma de recalcular hacia atrás.
 */
export interface MetaPricingSnapshot {
  /** `false` = Meta no lo cobra (ventana gratis, free entry point, reintento). */
  billable: boolean | null;
  /** 'PMP' = por mensaje. 'CBP' = por conversación (el modelo que se está yendo). */
  pricingModel: string | null;
  /** 'regular' | 'free_customer_service' | 'free_entry_point' | … */
  pricingType: string | null;
  category: MetaPricingCategory | string | null;
  /** Id de la conversación de 24 h de Meta, del modelo por conversación. */
  conversationId: string | null;
  conversationOrigin: string | null;
  conversationExpiresAt: Date | null;
  raw: Record<string, unknown> | null;
  /** Cuándo lo recibimos nosotros, no cuándo lo generó Meta. */
  receivedAt: Date;
}

const asString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * Normaliza el `pricing` + `conversation` crudos del webhook. Devuelve null si
 * no vino ninguno de los dos: un status sin datos de cobro no debe pisar con
 * nulls un snapshot que ya habíamos guardado.
 */
export function toMetaPricingSnapshot(
  pricing: unknown,
  conversation: unknown,
  receivedAt: Date,
): MetaPricingSnapshot | null {
  const hasPricing = !!pricing && typeof pricing === 'object';
  const hasConversation = !!conversation && typeof conversation === 'object';
  if (!hasPricing && !hasConversation) return null;

  const p = (hasPricing ? pricing : {}) as Record<string, unknown>;
  const c = (hasConversation ? conversation : {}) as Record<string, unknown>;

  const expiration = c.expiration_timestamp;
  const expiresAt =
    expiration != null && Number(expiration) > 0 ? new Date(Number(expiration) * 1000) : null;

  return {
    billable: typeof p.billable === 'boolean' ? p.billable : null,
    pricingModel: asString(p.pricing_model),
    pricingType: asString(p.type),
    category: asString(p.category),
    conversationId: asString(c.id),
    conversationOrigin: asString((c.origin as Record<string, unknown> | undefined)?.type),
    conversationExpiresAt: expiresAt,
    raw: {
      ...(hasPricing ? { pricing: p } : {}),
      ...(hasConversation ? { conversation: c } : {}),
    },
    receivedAt,
  };
}
