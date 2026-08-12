// Matches API domain entities

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  status: "available" | "busy" | "offline";
  activeCount: number;
  type?: "human" | "ai";
  frozen?: boolean;
  requiresOnboarding?: boolean;
}

export interface Conversation {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  contactId: string;
  agentId: string | null;
  status: "unassigned" | "active";
  lastMessageAt: string;
  lastInboundAt: string;
  createdAt: string;
  unreadCount: number;
  phoneLabel: string | null;
  phoneDisplay: string | null;
  agentName: string | null;
  agentType?: "human" | "ai" | null;
  labels?: { id: string; name: string; color: string }[];
  activeFlow?: { flowId: string; flowName: string; executionId: string; status: string } | null;
  autopilot?: ConversationAutopilot | null;
  /** Anuncio o posteo Click-to-WhatsApp que trajo el chat. */
  attribution?: ConversationAttribution | null;
  contact: {
    id: string;
    name: string;
    /** Null si el contacto solo comparte su username de WhatsApp. */
    phone: string | null;
    username: string | null;
    bsuid: string | null;
    profilePicUrl: string | null;
    email: string | null;
    company: string | null;
    notes: string | null;
    customFields: Record<string, string>;
    /** Pidió no recibir marketing desde WhatsApp. Null = puede recibirlo. */
    marketingOptOutAt?: string | null;
  } | null;
}

/**
 * Piloto automático de una conversación: si las automatizaciones pueden actuar
 * sobre ella. Es un eje distinto del de `agentId` (quién es el responsable).
 */
export interface MessageReferral {
  sourceType: "ad" | "post";
  sourceId: string;
  sourceUrl: string | null;
  headline: string | null;
  body: string | null;
  mediaType: "image" | "video" | null;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  ctwaClid: string | null;
}

export interface ConversationAttribution extends MessageReferral {
  capturedAt: string;
  waMessageId: string;
}

export interface AdPerformanceEntry {
  sourceId: string;
  sourceType: string;
  headline: string | null;
  body: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  conversations: number;
  contacts: number;
  assigned: number;
  unread: number;
  lastAt: string;
  messagesBillable: number;
  messagesFree: number;
  cost: number | null;
  currency: string | null;
}

export interface AdPerformanceResponse {
  entries: AdPerformanceEntry[];
  totals: {
    ads: number;
    conversations: number;
    contacts: number;
    assigned: number;
    unread: number;
    cost: number | null;
    currency: string | null;
  };
}

export interface ConversationAutopilot {
  enabled: boolean;
  pausedReason: "agent_reply" | "manual" | null;
  pausedAt: string | null;
}

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  /**
   * Dígitos E.164 sin '+'. Null para los usuarios que adoptaron username: ahí
   * `bsuid` es el único identificador estable.
   */
  phone: string | null;
  /** Username público de WhatsApp, sin '@'. */
  username: string | null;
  /** Business-Scoped User ID. */
  bsuid: string | null;
  profilePicUrl: string | null;
  lastSeenAt: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  customFields: Record<string, string>;
  /**
   * Cuándo el usuario apagó los mensajes de marketing desde WhatsApp. No es una
   * preferencia nuestra: mandarle campañas igual quema la calidad del número.
   */
  marketingOptOutAt?: string | null;
}

export type MediaKind = "image" | "video" | "audio" | "document" | "sticker";

export type MediaAssetStatus =
  | "meta_only"
  | "pending"
  | "ready"
  | "failed"
  | "expired_at_source";

export type MediaSource =
  | "inbound"
  | "agent_upload"
  | "library_upload"
  | "api"
  | "campaign";

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  filename: string | null;
  title: string | null;
  tags: string[];
  inLibrary: boolean;
  source: MediaSource;
  status: MediaAssetStatus;
  /** `false` = ni lo guardamos nosotros ni sigue vivo en WhatsApp. */
  available: boolean;
  /** Se está bajando a nuestro storage. */
  processing: boolean;
  /** Vive solo en WhatsApp: se pierde a los 30 días. */
  temporary: boolean;
  expiresAt: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  urlExpiresAt: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  conversationId: string | null;
  contactId: string | null;
  phoneNumberId: string | null;
  createdAt: string;
}

export interface MediaUsage {
  storedBytes: number;
  storedCount: number;
  byKind: { kind: MediaKind; count: number; bytes: number }[];
  metaOnlyCount: number;
  metaOnlyBytes: number;
  expiredCount: number;
  expiredBytes: number;
  /** `false` = passthrough: los archivos viven 30 días en WhatsApp. */
  storageEnabled: boolean;
  plan: string;
  /** El plan contratado incluye biblioteca. */
  planIncludesLibrary: boolean;
  /** Hay storage configurado en este entorno. Si es `false` con plan pago, falta config. */
  storageConfigured: boolean;
  quotaBytes: number;
  usedPercent: number | null;
  retentionDays: number;
  atRiskCount: number;
}

/** Ubicación compartida por un contacto. Las coordenadas siempre vienen. */
export interface MessageLocation {
  latitude: number;
  longitude: number;
  /** Nombre del lugar, cuando el contacto comparte un POI y no un pin suelto. */
  name?: string | null;
  address?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageType:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "sticker"
    | "location"
    | "template"
    | "interactive"
    | "contacts"
    | "reaction";
  body: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  mediaAssetId?: string | null;
  /** Archivo adjunto ya resuelto por el backend, listo para renderizar. */
  media?: MediaAsset | null;
  waMessageId: string;
  waStatus: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  senderAgentId: string | null;
  senderAgentName: string | null;
  /** Respuesta a un interactivo: id del botón/fila elegido */
  interactiveReplyId?: string | null;
  /** Anuncio Click-to-WhatsApp desde el que se abrió el chat. Solo en el primer mensaje tras el click. */
  referral?: MessageReferral | null;
  /**
   * `waMessageId` del mensaje citado al responder. En un `reaction` es el
   * mensaje al que apunta la reacción.
   */
  contextWaMessageId?: string | null;
  /** Outbound interactivo: definición de botones/lista para renderizar */
  interactivePayload?: {
    kind: "buttons" | "list";
    body: string;
    footer?: string;
    buttons?: Array<{ id: string; title: string }>;
    buttonText?: string;
    rows?: Array<{ id: string; title: string; description?: string }>;
  } | null;
  /** Mensajes `location`: coordenadas para dibujar el mapa en el chat. */
  location?: MessageLocation | null;
}

export interface PhoneNumber {
  id: string;
  tenantId: string;
  provider: "meta" | "demo";
  providerConfig: Record<string, string>;
  wabaId: string;
  /** Portfolio que scopea los BSUID. Null ⇒ se usa `wabaId`. */
  portfolioId: string | null;
  phoneNumberId: string;
  displayPhone: string;
  label: string;
  status: "active" | "inactive";
  /** Copia del perfil que sirve el proveedor. Null si nunca se consultó. */
  businessProfile?: WhatsAppBusinessProfile | null;
  /** Lo que Meta reporta del número. Null si nunca llegó un aviso. */
  health?: PhoneNumberHealth | null;
}

/**
 * Salud del número según Meta. La alimentan los webhooks de cuenta y la
 * sincronización; nosotros no la escribimos.
 */
export interface PhoneNumberHealth {
  /** GREEN | YELLOW | RED | UNKNOWN */
  qualityRating: string | null;
  /** STANDARD | HIGH | NOT_APPLICABLE */
  throughputLevel: string | null;
  /** APPROVED | REJECTED | PENDING */
  nameStatus: string | null;
  /** Baneo o restricción de la WABA, cuando Meta lo informa. */
  accountStatus: string | null;
  updatedAt: string | null;
}

/** Lo que el cliente ve antes de escribir: accesos rápidos y comandos. */
export interface ConversationalComponents {
  enabled: boolean;
  /** Hasta 4, de 80 caracteres, sin emojis. */
  iceBreakers: string[];
  /** Hasta 30. Nombre ≤ 32, descripción ≤ 256, sin emojis. */
  commands: Array<{ commandName: string; commandDescription: string }>;
}

export interface BlockedUser {
  waId: string;
  contactId: string | null;
  name: string | null;
}

/**
 * Perfil de negocio de WhatsApp: lo que ve el cliente al tocar el nombre del
 * chat en su teléfono. Ojo: `BusinessProfile` (sin prefijo) es otra cosa — el
 * perfil que se le carga a un asistente de IA para armar su prompt.
 */
export interface WhatsAppBusinessProfile {
  about: string | null;
  address: string | null;
  description: string | null;
  email: string | null;
  vertical: string | null;
  websites: string[];
  /** La sirve el proveedor; se cambia subiendo una imagen, no pegando una URL. */
  profilePictureUrl: string | null;
}

export interface WhatsAppBusinessProfileView {
  profile: WhatsAppBusinessProfile;
  editable: boolean;
  canChangePicture: boolean;
  /** La lectura vino de la copia local porque el proveedor no respondió. */
  stale: boolean;
  staleReason: string | null;
}

export interface Label {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface ConversationLabelEntry {
  id: string;
  labelId: string;
  labelName: string;
  labelColor: string;
  assignedBy: string;
  createdAt: string;
}

export interface ConversationEvent {
  id: string;
  conversationId: string;
  tenantId: string;
  type:
    | "created"
    | "assigned"
    | "reassigned"
    | "unassigned"
    | "resolved"
    | "reopened"
    | "note_added"
    | "handoff"
    | "label_added"
    | "label_removed"
    | "ad_attributed";
  performedBy: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ConversationNote {
  id: string;
  conversationId: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pages: number;
  };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  agent: Pick<Agent, "id" | "name" | "email" | "role">;
}

export type BusinessVertical = "beauty" | "food" | "retail" | "generic";

export interface CatalogItem {
  name: string;
  price: string;
  description: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

// El perfil del negocio y la conducta del asistente dejaron de vivir acá en
// ago-2026: el perfil es AccountBusinessProfile (una vez por cuenta) y la
// conducta viaja adentro del nodo de IA del flujo.

export type WeekDay =
  | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface BusinessHoursRange {
  open: string;  // "HH:mm"
  close: string; // "HH:mm"
}

export type BusinessHours = Partial<Record<WeekDay, BusinessHoursRange | null>>;

export type PlanTier = "free" | "pro" | "business" | "agencies";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

export interface Subscription {
  id: string;
  tenantId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  canceledAt: string | null;
  scheduledPlan: PlanTier | null;
  paymentProvider: "none" | "lemon_squeezy" | "stripe" | "mercado_pago";
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
}

export interface BillingRecord {
  id: string;
  tenantId: string;
  eventType: string;
  plan: PlanTier;
  amountCents: number;
  description: string;
  createdAt: string;
}

export interface ResourceUsage {
  current: number;
  limit: number;
  allowed: boolean;
}

export interface PlanUsage {
  plan: PlanTier;
  phoneNumbers: ResourceUsage;
  humanAgents: ResourceUsage;
  conversations: ResourceUsage;
}

export interface PlanLimits {
  maxPhoneNumbers: number;
  maxHumanAgents: number;
  maxConversationsPerMonth: number;
  webhooks: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean | "dedicated";
  whatsappSupport: boolean;
  priceMonthly: number;
}

export interface SubscriptionInfo {
  subscription: Subscription | null;
  plan: PlanTier;
  limits: PlanLimits;
}

export type ChatItem =
  | { kind: "message"; data: Message }
  | { kind: "event"; data: ConversationEvent }
  | { kind: "date"; date: string };

// Message Templates
export type TemplateStatus = "draft" | "pending" | "approved" | "rejected" | "paused" | "disabled";
export type TemplateCategory = "marketing" | "utility" | "authentication";
export type TemplateQuality = "unknown" | "green" | "yellow" | "red";

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: Record<string, unknown>;
  buttons?: TemplateButton[];
}

export interface MessageTemplate {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  metaTemplateId: string | null;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  qualityScore: TemplateQuality;
  components: TemplateComponent[];
  rejectionReason: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Campaigns
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export type CampaignRecipientStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped";

export interface VariableMapping {
  component: "header" | "body" | "button";
  index?: number;
  position: string;
  source: "contact_field" | "static";
  value: string;
}

export interface CampaignAudience {
  type: "contactIds" | "filter";
  contactIds?: string[];
  search?: string;
}

export interface CampaignCounts {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  replied: number;
}

export interface Campaign {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  templateId: string;
  name: string;
  status: CampaignStatus;
  variableMappings: VariableMapping[];
  audience: CampaignAudience;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  throttle: { messagesPerSecond: number; batchSize: number };
  replyWindowHours: number;
  counts: CampaignCounts;
  createdByAgentId: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  tenantId: string;
  contactId: string;
  phone: string | null;
  bsuid: string | null;
  resolvedVariables: Record<string, string>;
  status: CampaignRecipientStatus;
  attemptCount: number;
  waMessageId: string | null;
  messageId: string | null;
  conversationId: string | null;
  failureCode: string | null;
  failureReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface CampaignStats {
  counts: CampaignCounts & { pending: number };
  deliveredRate: number;
  readRate: number;
  responseRate: number;
  failureBreakdown: Array<{ code: string; title: string; count: number }>;
}

export interface ImportContactsResult {
  imported: number;
  updated: number;
  skipped: Array<{ row: number; reason: string }>;
}

/**
 * Datos del negocio de la cuenta: lo que los nodos de IA usan para armar su
 * prompt. No confundir con WhatsAppBusinessProfile, que es lo que ve el cliente
 * al tocar el nombre del chat en su teléfono.
 */
export interface AccountBusinessProfile {
  vertical: "beauty" | "food" | "retail" | "generic";
  businessName: string;
  description: string;
  address: string;
  paymentMethods: string;
  catalog: Array<{ name: string; price: string; description: string }>;
  faqs: Array<{ question: string; answer: string }>;
  extraNotes: string;
}

// ── Flujos ────────────────────────────────────────────────────────

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type FlowStatus = "draft" | "published" | "paused" | "archived";

/**
 * Sobre qué líneas va a actuar una automatización. Se elige al crearla; no se
 * deduce de una lista vacía, que es lo que antes hacía que "todavía no elegí"
 * y "quiero todas" fueran indistinguibles.
 */
export type PhoneScopeChoice =
  | { phoneScope: "all" }
  | { phoneScope: "specific"; phoneNumberIds: string[] };

export interface FlowSummary {
  id: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  publishedVersion: number | null;
  priority: number;
  stats: { started: number; completed: number; failed: number; cancelled: number };
  hasWebhookTrigger: boolean;
  updatedAt: string;
  /**
   * Número del que esta automatización es la base: la que decide quién atiende
   * cuando ninguna otra agarra el chat. Se crea sola al dar de alta el número
   * y siempre evalúa última. Null = automatización común.
   */
  defaultForPhoneNumberId: string | null;
  /** Números donde actúa el disparador. Vacío = todos los del tenant. */
  triggerPhoneNumberIds: string[];
}

export interface Flow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  draftGraph: FlowGraph;
  publishedVersionId: string | null;
  publishedVersion: number | null;
  priority: number;
  webhookToken: string | null;
  stats: { started: number; completed: number; failed: number; cancelled: number };
  createdAt: string;
  updatedAt: string;
}

export interface FlowDetailResponse {
  flow: Flow;
  publishedVersion: { id: string; version: number; graph: FlowGraph; createdAt: string } | null;
  hasUnpublishedChanges: boolean;
}

export interface FlowGraphIssue {
  nodeId?: string;
  code: string;
  message: string;
}

export type FlowExecutionStatus = "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface FlowStepLog {
  nodeId: string;
  type: string;
  status: "ok" | "error" | "skipped";
  handle: string | null;
  at: string;
  ms: number;
  note: string | null;
}

export interface FlowExecution {
  id: string;
  flowId: string;
  flowVersionId: string;
  conversationId: string;
  contactId: string;
  status: FlowExecutionStatus;
  currentNodeId: string | null;
  stepCount: number;
  variables: Record<string, unknown>;
  steps: FlowStepLog[];
  endReason: string | null;
  error: { nodeId: string; message: string } | null;
  startedAt: string;
  endedAt: string | null;
}

export interface FlowExecutionSummaryRow {
  execution: FlowExecution;
  contactName: string | null;
}

export interface FlowNodeStatsSummary {
  nodeId: string;
  entered: number;
  errors: number;
  outcomes: Record<string, number>;
}

export interface FlowTemplateDef {
  id: string;
  name: string;
  description: string;
  graph: FlowGraph;
}

export interface FlowConnection {
  id: string;
  name: string;
  headerName: string;
  createdAt: string;
}

export interface ActiveFlowInfo {
  flowId: string;
  flowName: string;
  executionId: string;
  status: string;
}
