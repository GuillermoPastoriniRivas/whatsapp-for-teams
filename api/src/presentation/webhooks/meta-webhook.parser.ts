// ── Meta Cloud API Webhook Parser ────────────────────────────────
// Pure functions — no NestJS dependencies, no side effects.

import type { InboundMessageInput } from '../../application/dtos/webhook/inbound-message-input.dto.js';
import type { StatusUpdateInput } from '../../application/dtos/webhook/status-update-input.dto.js';
import type {
  MetaWebhookPayload,
  MetaWebhookMessage,
  MetaWebhookContact,
  MetaWebhookStatus,
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

export function parseMetaWebhook(payload: MetaWebhookPayload): {
  messages: ParsedMetaMessage[];
  statuses: MetaWebhookStatus[];
} {
  const messages: ParsedMetaMessage[] = [];
  const statuses: MetaWebhookStatus[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
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

  return { messages, statuses };
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
  };
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
