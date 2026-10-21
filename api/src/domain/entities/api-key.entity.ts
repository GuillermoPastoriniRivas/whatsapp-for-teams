/**
 * Clave de API de un tenant. La clave en claro (`ak_live_...`) se muestra una
 * sola vez al crearla; acá solo persiste el hash SHA-256 y un prefijo para que
 * el usuario la reconozca en la lista.
 */
import type { ApiScope } from '../value-objects/api-scopes.js';

/**
 * Modo de la clave: `live` llega a Meta, `test` es sandbox y nunca llega.
 * Las claves creadas antes del sandbox son `live`.
 */
export type ApiKeyMode = 'live' | 'test';

export const API_KEY_MODES = ['live', 'test'] as const;

export const DEFAULT_API_KEY_MODE: ApiKeyMode = 'live';

/** Modo de una clave que viene de la base sin `mode` (o con uno inválido). */
export function normalizeApiKeyMode(raw: unknown): ApiKeyMode {
  return raw === 'test' ? 'test' : DEFAULT_API_KEY_MODE;
}

export class ApiKey {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    /** Primeros caracteres visibles de la clave, ej: "ak_live_3f9a" */
    public readonly prefix: string,
    /** SHA-256 hex de la clave completa; nunca sale de la API */
    public readonly keyHash: string,
    /** Qué puede hacer esta clave. Una clave que construye no manda mensajes salvo que se lo den. */
    public readonly scopes: ApiScope[],
    /** Sandbox: una clave `test` nunca debe alcanzar a Meta. */
    public readonly mode: ApiKeyMode,
    public readonly createdBy: string | null,
    public readonly lastUsedAt: Date | null,
    public readonly revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
