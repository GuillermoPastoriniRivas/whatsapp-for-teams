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
  status: "unassigned" | "active" | "resolved";
  lastMessageAt: string;
  lastInboundAt: string;
  createdAt: string;
  resolvedAt: string | null;
  closedBy: string | null;
  phoneLabel: string | null;
  phoneDisplay: string | null;
  agentName: string | null;
  labels?: { id: string; name: string; color: string }[];
  contact: {
    id: string;
    name: string;
    phone: string;
    waId: string;
    profilePicUrl: string | null;
    email: string | null;
    company: string | null;
    notes: string | null;
    customFields: Record<string, string>;
  } | null;
}

export interface Contact {
  id: string;
  tenantId: string;
  waId: string;
  name: string;
  phone: string;
  profilePicUrl: string | null;
  lastSeenAt: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  customFields: Record<string, string>;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "audio" | "video" | "document" | "location";
  body: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  waMessageId: string;
  waStatus: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  senderAgentId: string | null;
  senderAgentName: string | null;
}

export interface PhoneNumber {
  id: string;
  tenantId: string;
  provider: "meta" | "twilio" | "360dialog" | "kapso" | "demo";
  providerConfig: Record<string, string>;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  label: string;
  status: "active" | "inactive";
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
    | "label_removed";
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

export interface BusinessProfile {
  vertical: BusinessVertical;
  businessName: string;
  description: string;
  address: string;
  paymentMethods: string;
  catalog: CatalogItem[];
  faqs: FaqEntry[];
  extraNotes: string;
}

export interface BotBehavior {
  language: string;
  formality: "informal" | "formal";
  useEmojis: boolean;
  goal: string;
  customInstructions: string;
}

export interface AiAgentConfig {
  id: string;
  agentId: string;
  tenantId: string;
  businessProfile: BusinessProfile;
  behavior: BotBehavior;
  handoffRules: {
    keywords: string[];
    maxConsecutiveFailures: number;
    onCustomerRequest: boolean;
    urgencyKeywords: string[];
  };
  contextConfig: {
    maxHistoryMessages: number;
    includeContactInfo: boolean;
  };
  rateLimits: {
    maxMessagesPerDay: number;
    maxTokensPerDay: number;
  };
  multiMessage?: {
    enabled: boolean;
    maxBubbles: number;
    interBubbleDelayMs: number;
    debounceWindowMs: number;
    debounceMaxWaitMs: number;
  };
  timezone?: string | null;
  businessHours?: BusinessHours | null;
  isActive: boolean;
}

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
  aiBots: ResourceUsage;
  conversations: ResourceUsage;
}

export interface PlanLimits {
  maxPhoneNumbers: number;
  maxHumanAgents: number;
  maxAiBots: number;
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
  waId: string;
  phone: string;
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

export interface AiAgentWithConfig {
  id: string;
  name: string;
  type: "ai";
  status: string;
  activeCount: number;
  config: AiAgentConfig;
}
