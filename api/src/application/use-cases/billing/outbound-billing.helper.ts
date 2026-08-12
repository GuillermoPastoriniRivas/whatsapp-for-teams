import type { Conversation } from '../../../domain/entities/conversation.entity.js';
import type { Contact } from '../../../domain/entities/contact.entity.js';
import type { MessageSenderKind } from '../../../domain/entities/message.entity.js';
import type { EstimatedCategory, OutboundBillingContext } from '../../../domain/value-objects/outbound-billing.js';

/** Datos de la conversación que hacen falta para contabilizar un saliente. */
type BillableConversation = Pick<
  Conversation,
  'id' | 'tenantId' | 'phoneNumberId' | 'contactId' | 'lastInboundAt' | 'attribution'
>;

type BillableContact = Pick<Contact, 'phone' | 'bsuid'>;

export interface OutboundBillingExtras {
  senderKind: MessageSenderKind;
  templateId?: string | null;
  templateCategory?: EstimatedCategory | null;
  campaignId?: string | null;
  flowId?: string | null;
  marketingLite?: boolean;
  freeEntryPointAt?: Date | null;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Arma el contexto de facturación de un saliente que cuelga de un chat.
 *
 * Está acá y no repetido en cada caso de uso porque son siete puntos de envío y
 * lo que se olvida en uno es un agujero en la contabilidad que nadie ve hasta
 * que el total no cierra.
 */
export function billingForConversation(
  conversation: BillableConversation,
  contact: BillableContact | null,
  extras: OutboundBillingExtras,
): OutboundBillingContext {
  return {
    tenantId: conversation.tenantId,
    phoneNumberId: conversation.phoneNumberId,
    conversationId: conversation.id,
    contactId: conversation.contactId,
    destinationPhone: contact?.phone ?? null,
    destinationBsuid: contact?.bsuid ?? null,
    freeEntryPointAt: extras.freeEntryPointAt ?? conversation.attribution?.capturedAt ?? null,
    adSourceId: conversation.attribution?.sourceId ?? null,
    windowOpen: Date.now() - conversation.lastInboundAt.getTime() < TWENTY_FOUR_HOURS_MS,
    senderKind: extras.senderKind,
    templateId: extras.templateId ?? null,
    templateCategory: extras.templateCategory ?? null,
    campaignId: extras.campaignId ?? null,
    flowId: extras.flowId ?? null,
    marketingLite: extras.marketingLite ?? false,
  };
}

/**
 * Contexto de un saliente que **no** cuelga de ningún chat: un aviso mandado al
 * WhatsApp de un tercero que no es contacto de la bandeja.
 *
 * Ese envío no deja `Message` —no hay conversación ni contacto— y por eso era
 * invisible para toda la contabilidad, aunque Meta lo cobra igual. El charge no
 * necesita chat para escribirse.
 */
export function billingForNotice(input: {
  tenantId: string;
  phoneNumberId: string;
  to: string;
  senderKind: MessageSenderKind;
  /** Null cuando es texto libre dentro de la ventana del tercero. */
  templateId?: string | null;
  templateCategory?: EstimatedCategory | null;
  /** True sólo si el tercero nos escribió hace menos de 24 h. */
  windowOpen?: boolean;
  flowId?: string | null;
}): OutboundBillingContext {
  return {
    tenantId: input.tenantId,
    phoneNumberId: input.phoneNumberId,
    conversationId: null,
    contactId: null,
    destinationPhone: input.to,
    destinationBsuid: null,
    senderKind: input.senderKind,
    templateId: input.templateId ?? null,
    templateCategory: input.templateCategory ?? null,
    campaignId: null,
    flowId: input.flowId ?? null,
    freeEntryPointAt: null,
    adSourceId: null,
    // Una plantilla no necesita ventana abierta: es justamente la vía para
    // escribirle a alguien con quien no hay conversación.
    windowOpen: input.windowOpen ?? false,
    marketingLite: false,
  };
}
