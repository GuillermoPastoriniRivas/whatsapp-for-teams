// ── Matching de respuestas a nodos de espera ─────────────────────
// Puro. Orden: tap del botón (interactiveReplyId) → texto normalizado
// contra títulos → ordinal ("1", "2", …) → null (rama "other"/re-prompt).

import { normalizeText } from './flow-variable.resolver.js';
import type { FlowWaitState } from '../../../../domain/entities/flow-execution.entity.js';

export interface ReplyMatch {
  handle: string;
  /** Título elegido (para saveAs); null si vino de texto libre sin match */
  title: string | null;
}

export function matchReply(
  waitState: FlowWaitState,
  interactiveReplyId: string | null | undefined,
  body: string | null | undefined,
): ReplyMatch | null {
  // 1. Tap directo: el id 'fl:<nodeId>:<idx>' mapea al handle.
  if (interactiveReplyId && waitState.optionMap) {
    const handle = waitState.optionMap[interactiveReplyId];
    if (handle) {
      return { handle, title: titleForHandle(waitState, handle) };
    }
    // Tap de un mensaje interactivo viejo (otro nodo): no matchea esta espera.
    return null;
  }

  if (!body || !waitState.textMap) return null;
  const normalized = normalizeText(body);
  if (!normalized) return null;

  // 2. Texto igual a un título ("ver catalogo").
  const byTitle = waitState.textMap[normalized];
  if (byTitle) return { handle: byTitle, title: titleForHandle(waitState, byTitle) };

  // 3. Ordinal: "1", "1.", "1)"… en el orden de las opciones.
  const ordinalMatch = normalized.match(/^(\d{1,2})[.)]?$/);
  if (ordinalMatch) {
    const idx = parseInt(ordinalMatch[1], 10) - 1;
    const handles = orderedHandles(waitState);
    if (idx >= 0 && idx < handles.length) {
      return { handle: handles[idx], title: titleForHandle(waitState, handles[idx]) };
    }
  }

  return null;
}

/** Handles de opciones en orden de índice (btn:0, btn:1… / row:0…) */
function orderedHandles(waitState: FlowWaitState): string[] {
  const handles = new Set(Object.values(waitState.optionMap ?? {}));
  for (const handle of Object.values(waitState.textMap ?? {})) handles.add(handle);
  return [...handles].sort((a, b) => {
    const ai = parseInt(a.split(':')[1] ?? '0', 10);
    const bi = parseInt(b.split(':')[1] ?? '0', 10);
    return ai - bi;
  });
}

function titleForHandle(waitState: FlowWaitState, handle: string): string | null {
  for (const [text, h] of Object.entries(waitState.textMap ?? {})) {
    if (h === handle) return text;
  }
  return null;
}

// ── Validación del nodo "Pregunta" ───────────────────────────────

/**
 * Convierte una respuesta numérica en formato LATAM a número real:
 * "$ 1.500" → 1500, "1500,50" → 1500.5. Se guarda como número (no como el
 * texto crudo) para que al interpolarlo en un body JSON salga un literal
 * válido en vez de romper la request o permitir inyección.
 */
export function parseLatamNumber(body: string): number | null {
  const cleaned = body.trim().replace(/[\s$]/g, '');
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/.test(cleaned)) return null;
  // Con ambos separadores, el punto es de miles y la coma decimal.
  const normalized =
    cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/\.(?=\d{3}(\D|$))/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validateAnswer(validation: string | null, body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  switch (validation) {
    case 'numero':
      return parseLatamNumber(trimmed) !== null;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
    case 'telefono':
      return /^\+?[\d\s()-]{6,20}$/.test(trimmed);
    case 'texto':
    default:
      return true;
  }
}
