// ── Meta Cloud API Webhook Payload Types ─────────────────────────
// Used only in the presentation layer for parsing incoming webhooks.

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  field: string;
  value: MetaWebhookValue;
}

// ── WABA-level template webhook values ───────────────────────────
// These arrive with entry.id = wabaId and no metadata.phone_number_id.

export interface MetaTemplateStatusValue {
  event: string; // APPROVED | REJECTED | PAUSED | DISABLED | PENDING | ...
  message_template_id: number | string;
  message_template_name: string;
  message_template_language: string;
  reason?: string | null;
  disable_info?: { disable_date?: string };
}

export interface MetaTemplateQualityValue {
  previous_quality_score?: string;
  new_quality_score: string; // GREEN | YELLOW | RED | UNKNOWN
  message_template_id: number | string;
  message_template_name: string;
  message_template_language: string;
}

export interface MetaTemplateCategoryValue {
  previous_category?: string;
  new_category: string;
  message_template_id: number | string;
  message_template_name: string;
  message_template_language: string;
}

export interface ParsedTemplateEvent {
  wabaId: string;
  field: string;
  value: MetaTemplateStatusValue | MetaTemplateQualityValue | MetaTemplateCategoryValue;
}

export interface MetaWebhookValue {
  messaging_product: string;
  metadata?: {
    phone_number_id: string;
    display_phone_number: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

export interface MetaWebhookContact {
  wa_id: string;
  profile: { name: string };
}

export interface MetaWebhookMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  /** Present when the message replies to another (button taps always carry it). */
  context?: { id: string };
  // Each message type adds its own optional payload field.
  // Adding a new type = adding one optional field here + one case in the parser.
  text?: { body: string };
  image?: MetaMediaPayload;
  audio?: MetaMediaPayload;
  video?: MetaMediaPayload;
  document?: MetaMediaPayload & { filename?: string };
  sticker?: MetaMediaPayload;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { message_id: string; emoji: string };
  contacts?: unknown[];
  /** Reply to an interactive (non-template) buttons/list message. */
  interactive?: {
    type: 'button_reply' | 'list_reply' | string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  /** Reply to a template quick-reply button (Meta sends type 'button'). */
  button?: { payload: string; text: string };
}

export interface MetaMediaPayload {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface MetaWebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}
