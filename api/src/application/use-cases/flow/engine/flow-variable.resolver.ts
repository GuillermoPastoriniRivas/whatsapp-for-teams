// ── Resolución de variables {{path}} de flujos ───────────────────
// Funciones puras, sin dependencias del framework.

export interface FlowVariableContext {
  contact?: Record<string, unknown> | null;
  message?: Record<string, unknown> | null;
  vars?: Record<string, unknown> | null;
  webhook?: Record<string, unknown> | null;
  flow?: Record<string, unknown> | null;
  /** Quién escribe: `sender.type` lo lee el nodo Condición por dot-path. */
  sender?: Record<string, unknown> | null;
  ad?: Record<string, unknown> | null;
}

/** Acceso por dot-path con soporte de índices: items.0.price */
export function resolvePath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

const TEMPLATE_REGEX = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Renderiza {{path}} contra el contexto. Path inexistente ⇒ string vacío;
 * los paths no resueltos se devuelven en `missing` para loguear.
 */
export function renderTemplate(
  template: string,
  ctx: FlowVariableContext,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const root = ctx as unknown as Record<string, unknown>;

  const text = template.replace(TEMPLATE_REGEX, (_match, path: string) => {
    const value = resolvePath(root, path);
    if (value === undefined) {
      missing.push(path);
      return '';
    }
    return stringify(value);
  });

  return { text, missing };
}

/**
 * Renderiza un template JSON: los valores de variables se insertan
 * JSON-escapados para no romper la estructura ni permitir inyección.
 */
/** ¿El offset cae dentro de un string JSON del template? */
function insideJsonString(template: string, offset: number): boolean {
  let inString = false;
  for (let i = 0; i < offset; i++) {
    const char = template[i];
    if (char === '\\') {
      i++; // el escapado no abre ni cierra
      continue;
    }
    if (char === '"') inString = !inString;
  }
  return inString;
}

export function renderJsonTemplate(
  template: string,
  ctx: FlowVariableContext,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const root = ctx as unknown as Record<string, unknown>;

  const text = template.replace(TEMPLATE_REGEX, (match, path: string, offset: number) => {
    const value = resolvePath(root, path);
    const inString = insideJsonString(template, offset);

    if (value === undefined) {
      missing.push(path);
      // Fuera de comillas el vacío sería JSON inválido.
      return inString ? '' : 'null';
    }
    if (inString) {
      // Dentro de comillas se inserta solo el contenido escapado.
      return JSON.stringify(stringify(value)).slice(1, -1);
    }
    // En posición de valor va un literal JSON completo: sin esto, el texto
    // crudo del cliente rompe el body o permite inyectar estructura.
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value ?? null);
  });

  return { text, missing };
}

/** Normaliza texto para matching: minúsculas, sin tildes, trim */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
