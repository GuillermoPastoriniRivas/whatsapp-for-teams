import type { RegisteredTool } from './tool-registry.js';

export const MAX_EXTERNAL_LOOKUPS = 3;
export const EXTERNAL_LOOKUP_QUERY_PARAM = 'consulta';
export const MAX_EXTERNAL_RESPONSE_CHARS = 2000;
export const EXTERNAL_LOOKUP_PREFIX = 'consultar_';

export interface ExternalLookup {
  label: string;
  url: string;
  connectionId: string | null;
}

export function externalLookupsOf(data: Record<string, any>): ExternalLookup[] {
  const raw: Array<Record<string, unknown>> = Array.isArray(data.lookups) ? data.lookups : [];
  return raw
    .map((lookup) => ({
      label: String(lookup?.label ?? '').trim(),
      url: String(lookup?.url ?? '').trim(),
      connectionId: lookup?.connectionId ? String(lookup.connectionId) : null,
    }))
    .filter((lookup) => lookup.label.length > 0 && lookup.url.length > 0);
}

export function externalLookupToolName(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return `${EXTERNAL_LOOKUP_PREFIX}${slug || `externo_${index + 1}`}`;
}

export type ExternalLookupCaller = (
  lookup: ExternalLookup,
  query: string,
) => Promise<{ ok: boolean; body: string }>;

/**
 * Lo que el negocio conectó de sus propios sistemas. Cada consulta se describe
 * en una línea y toma UNA sola pregunta: es lo que evita que el usuario tenga
 * que pensar en parámetros. Si hace falta otra cosa, se agrega otra consulta.
 */
export function createExternalLookupTools(
  lookups: ExternalLookup[],
  call: ExternalLookupCaller,
): RegisteredTool[] {
  return lookups.slice(0, MAX_EXTERNAL_LOOKUPS).map((lookup, index) => ({
    definition: {
      name: externalLookupToolName(lookup.label, index),
      description:
        `Consulta el sistema del negocio para saber ${lookup.label}. Devuelve lo que ese sistema responda, tal cual. ` +
        'Si la respuesta no alcanza para contestar, decilo en vez de completar con lo que te parezca.',
      parameters: {
        type: 'object',
        properties: {
          [EXTERNAL_LOOKUP_QUERY_PARAM]: {
            type: 'string',
            description: `Qué querés averiguar sobre ${lookup.label}, en pocas palabras.`,
          },
        },
        required: [EXTERNAL_LOOKUP_QUERY_PARAM],
      },
    },
    handler: async (args) => {
      const query = String(args[EXTERNAL_LOOKUP_QUERY_PARAM] ?? '').trim();
      if (!query) return 'Error: falta qué consultar.';

      try {
        const result = await call(lookup, query);
        if (!result.ok) {
          return `El sistema del negocio no respondió correctamente. No inventes el dato: decí que no lo pudiste consultar.`;
        }
        const body = result.body.trim();
        if (!body) return 'El sistema respondió vacío: no hay dato para ese caso.';
        return body.length > MAX_EXTERNAL_RESPONSE_CHARS
          ? `${body.slice(0, MAX_EXTERNAL_RESPONSE_CHARS)}…`
          : body;
      } catch (error: any) {
        return `No se pudo consultar el sistema del negocio (${error.message}). No inventes el dato.`;
      }
    },
  }));
}
