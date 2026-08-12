export const API_SCOPES = ['messages:read', 'messages:write', 'flows:read', 'flows:write'] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/**
 * Las claves creadas antes de que existieran los permisos pueden hacer lo que
 * hacían: mensajería. No heredan los de flujos, así que ninguna clave que anda
 * dando vueltas gana de golpe la capacidad de reescribir automatizaciones.
 */
export const LEGACY_API_SCOPES: ApiScope[] = ['messages:read', 'messages:write'];

export const API_SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  'messages:read': 'Leer conversaciones, mensajes, contactos, números y plantillas',
  'messages:write': 'Mandar mensajes y crear contactos',
  'flows:read': 'Ver automatizaciones, sus versiones y validarlas',
  'flows:write': 'Crear y editar borradores, y probarlos en el simulador',
};

export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === 'string' && (API_SCOPES as readonly string[]).includes(value);
}

export function normalizeScopes(raw: unknown): ApiScope[] {
  if (!Array.isArray(raw)) return [...LEGACY_API_SCOPES];
  const scopes = raw.filter(isApiScope);
  return scopes.length > 0 ? [...new Set(scopes)] : [...LEGACY_API_SCOPES];
}
