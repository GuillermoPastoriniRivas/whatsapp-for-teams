import type { MessageSenderKind } from './message.entity.js';
import type { MetaPricingSnapshot } from '../value-objects/meta-pricing.js';
import type { EstimatedCategory } from '../value-objects/outbound-billing.js';

// ── El registro contable de un saliente ──────────────────────────
//
// Una fila por wamid que sale. Se escribe en el envío y se sella en la entrega.
//
// Existe aparte de `messages` porque un Message no sirve de libro contable: es
// mutable, no sabe de qué cuenta es, su estado se pisa, y hay salientes
// facturables que directamente no tienen Message (el aviso al proveedor).
//
// asis **no cobra nada por encima de los mensajes**: esto no es facturación
// nuestra, es la traducción a plata de lo que Meta le va a cobrar al cliente
// directo. Por eso la categoría de Meta siempre le gana a la nuestra, y la
// discrepancia entre las dos se guarda en vez de taparse: es un bug nuestro.

/**
 * Quién originó el saliente. Igual que en `Message`, más `unknown`: una fila
 * huérfana —creada por el webhook de entrega sin envío registrado— no tiene
 * forma de saberlo, y inventarle un origen ensuciaría los agrupados.
 */
export type ChargeSenderKind = MessageSenderKind | 'unknown';

/** De dónde salió la fila. Cambia cuánto se le puede creer. */
export type ChargeSource =
  /** Escrita en el envío, con todo el contexto congelado. Es la buena. */
  | 'live'
  /** Creada por el webhook de entrega sin envío previo (mensaje en vuelo al deployar). */
  | 'orphan'
  /** Reconstruida desde `messages` viejos. Estimación, nunca dato. */
  | 'backfill';

/** Lo que calculamos nosotros aplicando la rate card. Nunca es la factura. */
export interface ChargeRate {
  rateCardId: string;
  currency: string;
  /** Precio unitario de la card, en la moneda de la card. */
  unitPrice: number;
  /** Lo que estimamos que se cobró. 0 si no es facturable. */
  amount: number;
  /** Qué categoría se usó para tarifar, después de resolver Meta vs nosotros. */
  appliedCategory: string;
  computedAt: Date;
}

export interface MessageCharge {
  id: string;
  /** Único. Es la clave de idempotencia: Meta reenvía webhooks. */
  waMessageId: string;

  tenantId: string;
  phoneNumberId: string;
  conversationId: string | null;
  messageId: string | null;
  contactId: string | null;

  /** ISO-2 del destinatario. Null = no se pudo resolver (queda el prefijo). */
  destinationCountry: string | null;
  /** Prefijo crudo, para poder recalcular si el resolver estaba mal. */
  destinationPrefix: string | null;

  sentAt: Date;
  /** Write-once. Meta cobra entregado: sin esto no hay nada que tarifar. */
  deliveredAt: Date | null;
  failedAt: Date | null;
  waErrorCode: string | null;

  senderKind: ChargeSenderKind;
  campaignId: string | null;
  adSourceId: string | null;
  flowId: string | null;

  isTemplate: boolean;
  templateId: string | null;
  /** Congelada al enviar. La plantilla puede cambiar de categoría después. */
  templateCategory: EstimatedCategory | null;
  marketingLite: boolean;

  /** Lo que supusimos al enviar, antes de que Meta dijera nada. */
  estimatedCategory: EstimatedCategory;
  freeEntryPoint: boolean;
  windowOpen: boolean;

  /** Lo que dijo Meta. Null hasta que llega el `delivered`. */
  meta: MetaPricingSnapshot | null;
  rate: ChargeRate | null;
  source: ChargeSource;
}

/**
 * La categoría que hay que tarifar: la de Meta si la dijo, la nuestra si no.
 *
 * Meta es la fuente de verdad — es quien emite la factura. Nuestra estimación
 * sólo cubre el hueco entre el envío y el `delivered`, y los casos en que Meta
 * no manda `pricing`.
 */
export function billingCategoryOf(charge: MessageCharge): string {
  return charge.meta?.category ?? charge.estimatedCategory;
}

/**
 * Si Meta dijo `billable: false`, no se cobra y punto — sin importar lo que
 * hayamos estimado. Mientras no haya dicho nada, se usa nuestra estimación, que
 * es la que permite proyectar costos antes de que el mensaje se entregue.
 */
export function isBillable(charge: MessageCharge): boolean {
  if (charge.meta?.billable != null) return charge.meta.billable;
  if (charge.failedAt) return false;
  return !charge.freeEntryPoint;
}

/** Discrepancia entre lo que estimamos y lo que cobró Meta. Es un bug nuestro. */
export function hasCategoryMismatch(charge: MessageCharge): boolean {
  const metaCategory = charge.meta?.category;
  if (!metaCategory) return false;
  return metaCategory !== charge.estimatedCategory;
}
