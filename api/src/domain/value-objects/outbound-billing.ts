import type { MessageSenderKind } from '../entities/message.entity.js';

// ── Contexto de facturación de un saliente ───────────────────────
//
// Va como campo **obligatorio** de `MessagingApiPort.sendMessage`, y esa es toda
// la idea: el compilador rompe el día que alguien agregue un punto de envío
// nuevo y se olvide de contabilizarlo. Antes esto se resolvía "acordándose de
// escribir el Message después", y así fue como la plantilla que se le manda al
// proveedor terminó saliendo sin dejar rastro de ningún tipo.
//
// Todo lo de acá se congela en el momento del envío. Leerlo después de la
// plantilla o del contacto miente: la categoría de una plantilla cambia (Meta
// tiene un webhook para eso) y el contacto se edita.

/** Categoría que estimamos nosotros al enviar. Meta decide la real al entregar. */
export type EstimatedCategory =
  | 'marketing'
  | 'utility'
  | 'authentication'
  | 'service';

export interface OutboundBillingContext {
  tenantId: string;
  /** El id de **nuestra** línea, no el `phone_number_id` de Meta. */
  phoneNumberId: string;
  /** Null cuando el saliente no cuelga de ningún chat (aviso a un tercero). */
  conversationId: string | null;
  contactId: string | null;
  senderKind: MessageSenderKind;
  /**
   * Teléfono del destinatario en dígitos E.164 sin '+'. La tarifa de Meta es
   * por mercado del usuario, así que sin esto no hay precio posible.
   */
  destinationPhone: string | null;
  /** BSUID (`CC.…`): único rastro de país de quien sólo comparte username. */
  destinationBsuid?: string | null;

  templateId?: string | null;
  /** Categoría de la plantilla **al momento del envío**, no la de hoy. */
  templateCategory?: EstimatedCategory | null;

  campaignId?: string | null;
  flowId?: string | null;

  freeEntryPointAt?: Date | null;
  adSourceId?: string | null;
  /** Ventana de 24 h abierta al enviar. Un libre fuera de ventana no existe. */
  windowOpen?: boolean;
  /** Marketing Messages Lite: Meta lo reporta aparte en analytics. */
  marketingLite?: boolean;
}

/** Meta no cobra la entrega dentro de las 72 h del click en el anuncio. */
export const FREE_ENTRY_POINT_MS = 72 * 60 * 60 * 1000;

export function isWithinFreeEntryPoint(clickedAt: Date | null | undefined, at: Date): boolean {
  if (!clickedAt) return false;
  const elapsed = at.getTime() - clickedAt.getTime();
  return elapsed >= 0 && elapsed < FREE_ENTRY_POINT_MS;
}
