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
  provider: "meta" | "twilio" | "360dialog" | "kapso";
  providerConfig: Record<string, string>;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  label: string;
  status: "active" | "inactive";
  plugins?: string[];
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

export interface AiAgentConfig {
  id: string;
  agentId: string;
  tenantId: string;
  provider: "openai" | "anthropic" | "gemini" | "openrouter";
  model: string;
  apiKeySet: boolean;
  systemPrompt: string;
  knowledgeBase: string;
  goals: string;
  persona: {
    role: string;
    tone: string;
    language: string;
    instructions: string;
  };
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
  isActive: boolean;
}

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

// Orders
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

export interface Order {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  createdByAgentId: string | null;
  status: OrderStatus;
  items: OrderItem[];
  deliveryType: "delivery" | "pickup";
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  estimatedTotal: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  contactName?: string;
}

export interface AiAgentWithConfig {
  id: string;
  name: string;
  type: "ai";
  status: string;
  activeCount: number;
  config: AiAgentConfig;
}
