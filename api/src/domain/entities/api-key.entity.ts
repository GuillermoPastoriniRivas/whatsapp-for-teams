/**
 * Clave de API de un tenant. La clave en claro (`ak_live_...`) se muestra una
 * sola vez al crearla; acá solo persiste el hash SHA-256 y un prefijo para que
 * el usuario la reconozca en la lista.
 */
import type { ApiScope } from '../value-objects/api-scopes.js';

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
    public readonly createdBy: string | null,
    public readonly lastUsedAt: Date | null,
    public readonly revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
