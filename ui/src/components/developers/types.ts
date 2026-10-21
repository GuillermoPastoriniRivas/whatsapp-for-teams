export interface DeveloperOverview {
  plan: string;
  apiAccess: boolean;
  webhooks: boolean;
  activeApiKeys: number;
  webhookEndpoints: number;
}

export type ApiScope =
  | "messages:read"
  | "messages:write"
  | "flows:read"
  | "flows:write"
  | "notifications:read"
  | "notifications:write";

/**
 * Modo de una clave de API.
 * - `live`: envía de verdad a Meta y se cobra según el plan.
 * - `test`: sandbox. No llega a Meta y no genera costo.
 */
export type ApiKeyMode = "live" | "test";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  /** El backend lo devuelve siempre; si falta, la UI no inventa un modo. */
  mode?: ApiKeyMode;
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
