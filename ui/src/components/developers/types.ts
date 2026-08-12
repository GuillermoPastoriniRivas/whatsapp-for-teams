export interface DeveloperOverview {
  plan: string;
  apiAccess: boolean;
  webhooks: boolean;
  activeApiKeys: number;
  webhookEndpoints: number;
}

export type ApiScope = "messages:read" | "messages:write" | "flows:read" | "flows:write";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey {
  apiKey: ApiKeyView;
  plainKey: string;
}

export interface WebhookEndpointView {
  id: string;
  url: string;
  description: string | null;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WebhookDeliveryView {
  id: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  status: "pending" | "success" | "failed";
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  lastError: string | null;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; pages: number };
}

/** Base de la API (mismo origen que usa el cliente autenticado) */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
