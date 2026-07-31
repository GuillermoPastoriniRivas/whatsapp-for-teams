import { createHash, createHmac, randomBytes } from 'node:crypto';
import { ApiKey } from '../../../domain/entities/api-key.entity.js';
import { WebhookEndpoint } from '../../../domain/entities/webhook-endpoint.entity.js';

/** Genera una clave de API en claro: ak_live_ + 40 hex (160 bits de entropía). */
export function generateApiKey(): string {
  return `ak_live_${randomBytes(20).toString('hex')}`;
}

export function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey, 'utf8').digest('hex');
}

/** Prefijo visible para identificar la clave en la lista: "ak_live_3f9a…" */
export function apiKeyPrefix(plainKey: string): string {
  return plainKey.slice(0, 12);
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function generateEventId(): string {
  return `evt_${randomBytes(12).toString('hex')}`;
}

/** Firma de una entrega: HMAC-SHA256(secret, "<timestamp>.<body>") en hex. */
export function signWebhookPayload(secret: string, timestampSeconds: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestampSeconds}.${body}`, 'utf8').digest('hex');
}

/** Vista pública de una clave (sin hash). */
export function toApiKeyView(key: ApiKey) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  };
}

export type ApiKeyView = ReturnType<typeof toApiKeyView>;

/** Vista pública de un endpoint (incluye el secreto: es del propio tenant). */
export function toWebhookEndpointView(endpoint: WebhookEndpoint) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    description: endpoint.description,
    secret: endpoint.secret,
    events: endpoint.events,
    active: endpoint.active,
    createdAt: endpoint.createdAt,
  };
}

export type WebhookEndpointView = ReturnType<typeof toWebhookEndpointView>;
