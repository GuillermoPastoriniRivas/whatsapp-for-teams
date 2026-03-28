// Matches API domain entities

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  status: "available" | "busy" | "offline";
  activeCount: number;
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
  contact: {
    name: string;
    phone: string;
    waId: string;
    profilePicUrl: string | null;
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
  provider: "meta" | "twilio" | "360dialog";
  providerConfig: Record<string, string>;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  label: string;
  status: "active" | "inactive";
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
    | "reopened";
  performedBy: string | null;
  data: Record<string, unknown>;
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
