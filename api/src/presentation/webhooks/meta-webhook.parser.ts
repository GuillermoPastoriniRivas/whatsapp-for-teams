// ── Meta Cloud API Webhook Parser ────────────────────────────────
// Pure functions — no NestJS dependencies, no side effects.

import { toMessageLocation } from '../../domain/value-objects/message-location.js';
import type { InboundMessageInput, UserIdUpdateInput } from '../../application/dtos/webhook/inbound-message-input.dto.js';
import type { StatusUpdateInput } from '../../application/dtos/webhook/status-update-input.dto.js';
import type { TemplateEventInput } from '../../application/dtos/webhook/template-event-input.dto.js';
import type {
  MetaWebhookPayload,
  MetaWebhookMessage,
  MetaWebhookContact,
  MetaWebhookStatus,
  MetaTemplateQualityValue,
  MetaTemplateStatusValue,
  MetaTemplateCategoryValue,
  MetaUserIdUpdateValue,
  MetaAccountEventValue,
  MetaUserPreferenceValue,
  ParsedTemplateEvent,
  ParsedUserIdUpdate,
  ParsedAccountEvent,
  ParsedUserPreference,
} from './meta-webhook.types.js';

// ── Intermediate type after flattening ───────────────────────────

export interface ParsedMetaMessage {
  message: MetaWebhookMessage;
  contact: MetaWebhookContact | undefined;
}

// ── Supported message type mapping ───────────────────────────────
// Add one entry here when a new MessageType is added to the enum.

const SUPPORTED_TYPES: Record<string, string> = {
  text: 'text',
  image: 'image',
  audio: 'audio',
  video: 'video',
  document: 'document',
  sticker: 'sticker',
  location: 'location',
  // Respuestas a mensajes interactivos (botones/listas) y a quick-replies de
  // plantillas ('button'). Se persisten como 'interactive'.
  interactive: 'interactive',
  button: 'interactive',
  // Tarjeta de contacto: es lo que llega cuando el usuario toca
  // `REQUEST_CONTACT_INFO` y comparte su número.
  contacts: 'contacts',
  // Reacción con emoji a un mensaje nuestro.
  reaction: 'reaction',
};

const MEDIA_TYPES = new Set(['image', 'audio', 'video', 'document', 'sticker']);

// ── Status mapping ───────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
};

// ── 1. Flatten the nested payload ────────────────────────────────

// WABA-level webhook fields carrying template lifecycle events.
const TEMPLATE_EVENT_FIELDS = new Set([
  'message_template_status_update',
  'message_template_quality_update',
  'template_category_update',
]);

/**
 * Campos de salud de la cuenta y del número. Son los que avisan que algo se
 * rompió —baneo, violación de política, caída de calidad, verificación del
 * nombre— y sin ellos el primero en enterarse es siempre el cliente.
 */
const ACCOUNT_EVENT_FIELDS = new Set([
  'account_update',
  'account_alerts',
  'account_review_update',
  'business_capability_update',
  'phone_number_quality_update',
  'phone_number_name_update',
  'message_template_components_update',
]);

export function parseMetaWebhook(payload: MetaWebhookPayload): {
  messages: ParsedMetaMessage[];
  statuses: MetaWebhookStatus[];
  templateEvents: ParsedTemplateEvent[];
  userIdUpdates: ParsedUserIdUpdate[];
  accountEvents: ParsedAccountEvent[];
  userPreferences: ParsedUserPreference[];
} {
  const messages: ParsedMetaMessage[] = [];
  const statuses: MetaWebhookStatus[] = [];
  const templateEvents: ParsedTemplateEvent[] = [];
  const userIdUpdates: ParsedUserIdUpdate[] = [];
  const accountEvents: ParsedAccountEvent[] = [];
  const userPreferences: ParsedUserPreference[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (TEMPLATE_EVENT_FIELDS.has(change.field)) {
        templateEvents.push({
          wabaId: entry.id,
          field: change.field,
          value: change.value as unknown as ParsedTemplateEvent['value'],
        });
        continue;
      }

      if (ACCOUNT_EVENT_FIELDS.has(change.field)) {
        const value = change.value as unknown as MetaAccountEventValue;
        accountEvents.push({
          wabaId: entry.id,
          field: change.field,
          displayPhoneNumber: normalizePhone(value.display_phone_number),
          value,
        });
        continue;
      }

      if (change.field === 'user_preferences') {
        userPreferences.push(
          ...parseUserPreferences(entry.id, change.value as unknown as Record<string, unknown>),
        );
        continue;
      }

      if (change.field === 'user_id_update') {
        const parsed = parseUserIdUpdate(entry.id, change.value as unknown as MetaUserIdUpdateValue);
        if (parsed) userIdUpdates.push(parsed);
        continue;
      }

      if (change.field !== 'messages') continue;

      const { value } = change;
      const contacts = value.contacts ?? [];

      for (const msg of value.messages ?? []) {
        messages.push({ message: msg, contact: pairContact(contacts, msg) });
      }

      for (const status of value.statuses ?? []) {
        statuses.push(status);
      }
    }
  }

  return { messages, statuses, templateEvents, userIdUpdates, accountEvents, userPreferences };
}

/** Deja el teléfono en dígitos, como lo guardamos. */
function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/**
 * `user_preferences` puede traer una lista o un único objeto según el evento.
 * Solo interesa la categoría de marketing: el resto se ignora sin ruido.
 */
function parseUserPreferences(wabaId: string, value: Record<string, unknown>): ParsedUserPreference[] {
  const raw = value?.user_preferences;
  const entries: MetaUserPreferenceValue[] = Array.isArray(raw)
    ? (raw as MetaUserPreferenceValue[])
    : [value as MetaUserPreferenceValue];

  const parsed: ParsedUserPreference[] = [];

  for (const entry of entries) {
    const category = String(entry?.category ?? '').toLowerCase();
    // Vacío también entra: hay eventos que no repiten la categoría.
    if (category && !category.includes('marketing')) continue;

    const decision = String(entry?.value ?? '').toLowerCase();
    if (decision !== 'stop' && decision !== 'resume') continue;

    const phone = normalizePhone(entry?.wa_id);
    const bsuid = typeof entry?.user_id === 'string' ? entry.user_id : null;
    if (!phone && !bsuid) continue;

    const seconds = Number(entry?.timestamp);
    parsed.push({
      wabaId,
      phone,
      bsuid,
      optedOut: decision === 'stop',
      timestamp: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(),
    });
  }

  return parsed;
}

/**
 * Empareja un mensaje con su bloque de contacto.
 *
 * El BSUID manda porque es el único identificador siempre presente. Nunca se
 * comparan campos ausentes entre sí: `undefined === undefined` daba `true` y
 * enganchaba al primer contacto del array, cruzando mensajes entre personas
 * distintas en payloads con varios contactos.
 */
function pairContact(
  contacts: MetaWebhookContact[],
  msg: MetaWebhookMessage,
): MetaWebhookContact | undefined {
  if (msg.from_user_id) {
    const byBsuid = contacts.find((c) => c.user_id && c.user_id === msg.from_user_id);
    if (byBsuid) return byBsuid;
  }

  if (msg.from) {
    const byPhone = contacts.find((c) => c.wa_id && c.wa_id === msg.from);
    if (byPhone) return byPhone;
  }

  // Con un único contacto en el cambio no hay ambigüedad posible.
  return contacts.length === 1 ? contacts[0] : undefined;
}

/**
 * Meta no publica el shape de `user_id_update`, así que se aceptan los alias
 * plausibles y se descarta el evento si no se resuelve el par viejo→nuevo.
 * Confirmar contra un payload real antes de confiar en esto.
 */
function parseUserIdUpdate(wabaId: string, value: MetaUserIdUpdateValue): ParsedUserIdUpdate | null {
  const previousBsuid = value.previous_user_id ?? value.old_user_id;
  const newBsuid = value.new_user_id ?? value.user_id;

  if (!previousBsuid || !newBsuid || previousBsuid === newBsuid) return null;

  return { wabaId, previousBsuid, newBsuid, phone: value.wa_id ?? null };
}

// ── 2. Map a single Meta message → InboundMessageInput ───────────

export function mapMetaMessageToInbound(
  parsed: ParsedMetaMessage,
  phoneNumberId: string,
): InboundMessageInput | null {
  const { message: msg, contact } = parsed;

  const messageType = SUPPORTED_TYPES[msg.type];
  if (!messageType) return null; // unsupported type — caller should log & skip

  // Quitar una reacción llega como una reacción de emoji vacío. No es un
  // mensaje que valga una burbuja: se ignora.
  if (msg.type === 'reaction' && !msg.reaction?.emoji) return null;

  const bsuid = msg.from_user_id ?? contact?.user_id;
  const phone = msg.from ?? contact?.wa_id;

  // Sin ninguno de los dos ejes no hay contacto al que atribuir el mensaje.
  if (!phone && !bsuid) return null;

  const media = extractMedia(msg);
  const username = contact?.profile?.username?.replace(/^@/, '');

  return {
    phoneNumberId,
    waMessageId: msg.id,
    from: phone,
    bsuid,
    parentBsuid: msg.from_parent_user_id ?? contact?.parent_user_id,
    username,
    sharedPhone: extractSharedPhone(msg),
    contactName: contact?.profile?.name ?? username ?? phone,
    messageType,
    body: extractBody(msg),
    mediaId: media?.id,
    mimeType: media?.mimeType,
    mediaFilename: media?.filename,
    mediaSha256: media?.sha256,
    timestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
    interactiveReplyId: extractInteractiveReplyId(msg),
    // La reacción no usa `context`: apunta a su objetivo por su propio campo.
    contextWaMessageId: msg.type === 'reaction' ? msg.reaction?.message_id : msg.context?.id,
    location: msg.type === 'location' && msg.location ? toMessageLocation(msg.location) : null,
  };
}

/** Mapea un `user_id_update` ya parseado al input de la capa de aplicación. */
export function mapUserIdUpdateToInput(parsed: ParsedUserIdUpdate): UserIdUpdateInput {
  return parsed;
}

// ── 3. Map a Meta status → StatusUpdateInput ─────────────────────

export function mapMetaStatusToUpdate(status: MetaWebhookStatus): StatusUpdateInput {
  return {
    waMessageId: status.id,
    status: STATUS_MAP[status.status] ?? 'sent',
    timestamp: new Date(parseInt(status.timestamp, 10) * 1000),
    errors: status.errors?.map((e) => ({ code: e.code, title: e.title })),
  };
}

// ── 4. Map a WABA-level template event → TemplateEventInput ──────

export function mapTemplateEventToInput(event: ParsedTemplateEvent): TemplateEventInput {
  const base = event.value as {
    message_template_id?: number | string;
    message_template_name?: string;
    message_template_language?: string;
  };

  const input: TemplateEventInput = {
    wabaId: event.wabaId,
    field: event.field,
    metaTemplateId: base.message_template_id != null ? String(base.message_template_id) : null,
    name: base.message_template_name ?? '',
    language: base.message_template_language ?? '',
  };

  if (event.field === 'message_template_status_update') {
    const value = event.value as MetaTemplateStatusValue;
    input.event = value.event;
    input.reason = value.reason ?? null;
  } else if (event.field === 'message_template_quality_update') {
    const value = event.value as MetaTemplateQualityValue;
    input.newQualityScore = value.new_quality_score;
  } else if (event.field === 'template_category_update') {
    const value = event.value as MetaTemplateCategoryValue;
    input.newCategory = value.new_category;
  }

  return input;
}

// ── Internal helpers ─────────────────────────────────────────────

function extractBody(msg: MetaWebhookMessage): string | undefined {
  switch (msg.type) {
    case 'text':
      return msg.text?.body;
    case 'image':
      return msg.image?.caption;
    case 'video':
      return msg.video?.caption;
    case 'document':
      return msg.document?.caption;
    // Las coordenadas no van en el body: viajan estructuradas en `location`,
    // que es lo que dibuja el mapa. Acá solo el nombre del lugar, si lo hay.
    case 'location':
      return [msg.location?.name, msg.location?.address].filter(Boolean).join(': ') || undefined;
    case 'interactive':
      return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title;
    // El emoji ES el contenido de la reacción.
    case 'reaction':
      return msg.reaction?.emoji || undefined;
    case 'button':
      return msg.button?.text;
    case 'contacts': {
      const shared = msg.contacts?.[0];
      const name = shared?.name?.formatted_name ?? shared?.name?.first_name;
      const number = shared?.phones?.[0]?.phone ?? shared?.phones?.[0]?.wa_id;
      return [name, number].filter(Boolean).join(' · ') || undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Teléfono que el usuario compartió en una tarjeta de contacto. Es la única vía
 * para recuperar el número de alguien que solo se identifica por username, y
 * llega tras un botón `REQUEST_CONTACT_INFO`.
 *
 * Se prefiere `wa_id` sobre `phone`: el primero ya viene en dígitos, el segundo
 * suele traer formato humano ('+54 9 11 …').
 */
function extractSharedPhone(msg: MetaWebhookMessage): string | undefined {
  if (msg.type !== 'contacts') return undefined;

  for (const shared of msg.contacts ?? []) {
    for (const entry of shared.phones ?? []) {
      const digits = (entry.wa_id ?? entry.phone ?? '').replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) return digits;
    }
  }
  return undefined;
}

function extractInteractiveReplyId(msg: MetaWebhookMessage): string | undefined {
  if (msg.type === 'interactive') {
    return msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id;
  }
  if (msg.type === 'button') {
    return msg.button?.payload;
  }
  return undefined;
}

interface ExtractedMedia {
  id: string;
  mimeType: string | undefined;
  filename: string | undefined;
  sha256: string | undefined;
}

/**
 * El webhook trae un id, no el archivo. Bajarlo son dos requests más contra
 * Graph, así que acá solo se extrae la referencia y la ingesta va por su
 * propio job — el webhook tiene que devolver 200 rápido.
 */
function extractMedia(msg: MetaWebhookMessage): ExtractedMedia | undefined {
  if (!MEDIA_TYPES.has(msg.type)) return undefined;

  const media = msg[msg.type as keyof typeof msg] as
    | { id?: string; mime_type?: string; filename?: string; sha256?: string }
    | undefined;

  if (!media?.id) return undefined;

  return {
    id: media.id,
    mimeType: media.mime_type,
    filename: media.filename,
    // Meta lo manda en base64; se normaliza a hex, que es como lo guardamos.
    sha256: media.sha256 ? Buffer.from(media.sha256, 'base64').toString('hex') : undefined,
  };
}
