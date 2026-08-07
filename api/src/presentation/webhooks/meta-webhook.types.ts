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
  /** Se **omite** (no llega vacío) si el usuario no comparte su teléfono. */
  wa_id?: string;
  /** BSUID. Presente siempre desde abril 2026. */
  user_id?: string;
  parent_user_id?: string;
  profile: { name?: string; username?: string };
}

export interface MetaWebhookMessage {
  id: string;
  /** Teléfono del remitente. Omitido para usuarios que solo comparten username. */
  from?: string;
  from_user_id?: string;
  from_parent_user_id?: string;
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
  /** Tarjetas de contacto compartidas; es la respuesta a `REQUEST_CONTACT_INFO`. */
  contacts?: MetaSharedContact[];
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

export interface MetaSharedContact {
  name?: { formatted_name?: string; first_name?: string };
  phones?: Array<{ phone?: string; wa_id?: string; type?: string }>;
}

export interface MetaWebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id?: string;
  recipient_user_id?: string;
  recipient_parent_user_id?: string;
  errors?: Array<{ code: number; title: string }>;
}

/**
 * Campo `user_id_update`: Meta regenera el BSUID cuando el usuario cambia de
 * teléfono y avisa con el valor viejo y el nuevo.
 *
 * OJO: Meta no publica el shape exacto de este payload, así que se leen varios
 * alias plausibles y se descarta el evento si no se puede resolver el par.
 * Confirmar contra un payload real antes de confiar en él.
 */
export interface MetaUserIdUpdateValue {
  user_id?: string;
  new_user_id?: string;
  previous_user_id?: string;
  old_user_id?: string;
  wa_id?: string;
  [key: string]: unknown;
}

export interface ParsedUserIdUpdate {
  wabaId: string;
  previousBsuid: string;
  newBsuid: string;
  phone: string | null;
}

// ── Salud de la cuenta y del número ──────────────────────────────
// Todos llegan a nivel WABA (`entry.id` = wabaId). Algunos traen además el
// número al que aplican; los que no, valen para todos los números de la WABA.

export interface MetaAccountEventValue {
  /** `phone_number_quality_update`, `phone_number_name_update`. */
  display_phone_number?: string;
  /** Nivel de throughput del número: STANDARD / HIGH / NOT_APPLICABLE. */
  current_limit?: string;
  /** GREEN | YELLOW | RED | UNKNOWN */
  event?: string;
  /** `phone_number_name_update`: APPROVED | REJECTED. */
  decision?: string;
  requested_verified_name?: string;
  reject_reason?: string;
  /** `account_update`: PARTNER_ADDED, ACCOUNT_VIOLATION, ACCOUNT_RESTRICTION… */
  ban_info?: { waba_ban_state?: string; waba_ban_date?: string };
  restriction_info?: Array<{ restriction_type?: string; expiration?: string }>;
  violation_info?: { violation_type?: string };
  [key: string]: unknown;
}

export interface ParsedAccountEvent {
  wabaId: string;
  field: string;
  /** Número al que aplica, si el evento lo trae. Null = toda la WABA. */
  displayPhoneNumber: string | null;
  value: MetaAccountEventValue;
}

/**
 * Campo `user_preferences`: el usuario prendió o apagó los mensajes de
 * marketing. Respetarlo no es opcional — ignorarlo quema la calidad del número
 * y termina en suspensión.
 *
 * Meta documenta `category: 'marketing_messages'` y `value: 'stop' | 'resume'`.
 * Se leen alias plausibles porque el shape no está publicado con precisión, y
 * se descarta lo que no se pueda resolver.
 */
export interface MetaUserPreferenceValue {
  wa_id?: string;
  user_id?: string;
  category?: string;
  value?: string;
  detail?: string;
  timestamp?: string | number;
  [key: string]: unknown;
}

export interface ParsedUserPreference {
  wabaId: string;
  phone: string | null;
  bsuid: string | null;
  /** `true` = el usuario pidió NO recibir más marketing. */
  optedOut: boolean;
  timestamp: Date;
}
