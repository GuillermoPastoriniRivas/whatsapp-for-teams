// ── Meta Cloud API Webhook Parser ────────────────────────────────
// Pure functions — no NestJS dependencies, no side effects.

import type { InboundMessageInput } from '../../application/dtos/webhook/inbound-message-input.dto.js';
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
  ParsedTemplateEvent,
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
  location: 'location',
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

export function parseMetaWebhook(payload: MetaWebhookPayload): {
  messages: ParsedMetaMessage[];
  statuses: MetaWebhookStatus[];
  templateEvents: ParsedTemplateEvent[];
} {
  const messages: ParsedMetaMessage[] = [];
  const statuses: MetaWebhookStatus[] = [];
  const templateEvents: ParsedTemplateEvent[] = [];

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

      if (change.field !== 'messages') continue;

      const { value } = change;
      const contacts = value.contacts ?? [];

      // Pair each message with its contact (matched by from === wa_id)
      for (const msg of value.messages ?? []) {
        const contact = contacts.find((c) => c.wa_id === msg.from);
        messages.push({ message: msg, contact });
      }

      for (const status of value.statuses ?? []) {
        statuses.push(status);
      }
    }
  }

  return { messages, statuses, templateEvents };
}

// ── 2. Map a single Meta message → InboundMessageInput ───────────

export function mapMetaMessageToInbound(
  parsed: ParsedMetaMessage,
  phoneNumberId: string,
  apiVersion: string,
): InboundMessageInput | null {
  const { message: msg, contact } = parsed;

  const messageType = SUPPORTED_TYPES[msg.type];
  if (!messageType) return null; // unsupported type — caller should log & skip

  return {
    phoneNumberId,
    waMessageId: msg.id,
    from: msg.from,
    contactName: contact?.profile?.name ?? msg.from,
    messageType,
    body: extractBody(msg),
    mediaUrl: extractMediaUrl(msg, apiVersion),
    mimeType: extractMimeType(msg),
    timestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
  };
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
    case 'location': {
      const loc = msg.location;
      if (!loc) return undefined;
      if (loc.name || loc.address) {
        return [loc.name, loc.address].filter(Boolean).join(': ');
      }
      return `${loc.latitude},${loc.longitude}`;
    }
    default:
      return undefined;
  }
}

function extractMediaUrl(msg: MetaWebhookMessage, apiVersion: string): string | undefined {
  if (!MEDIA_TYPES.has(msg.type)) return undefined;

  const media = msg[msg.type as keyof typeof msg] as { id?: string } | undefined;
  const mediaId = media?.id;
  if (!mediaId) return undefined;

  return `https://graph.facebook.com/${apiVersion}/${mediaId}`;
}

function extractMimeType(msg: MetaWebhookMessage): string | undefined {
  if (!MEDIA_TYPES.has(msg.type)) return undefined;

  const media = msg[msg.type as keyof typeof msg] as { mime_type?: string } | undefined;
  return media?.mime_type;
}
