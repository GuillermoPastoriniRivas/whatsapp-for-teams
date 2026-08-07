// ── Catálogo de tipos de nodo del motor de flujos ────────────────
// Fuente única de verdad de tipos y handles de salida; la usan el
// validador, el motor y (espejada) la UI.

import type { FlowNode } from '../../../../domain/entities/flow.entity.js';

export const TRIGGER_TYPES = ['trigger.inbound_message', 'trigger.webhook', 'trigger.campaign_reply'] as const;

export const NODE_TYPES = [
  ...TRIGGER_TYPES,
  'action.send_text',
  'action.send_media',
  'action.send_location',
  'action.send_buttons',
  'action.send_list',
  'action.send_cta_url',
  'action.send_template',
  'action.ask',
  'action.ai_reply',
  'logic.ai_route',
  'action.handoff_ai',
  'action.handoff_human',
  'action.assign_agent',
  'action.label',
  'action.update_contact',
  'action.internal_note',
  'action.set_variable',
  'action.emit_event',
  'logic.condition',
  'logic.delay',
  'logic.wait_business_hours',
  'action.http',
] as const;

export type FlowNodeType = (typeof NODE_TYPES)[number];

export function isTrigger(type: string): boolean {
  return type.startsWith('trigger.');
}

/** Nodos que consumen el modelo de IA (y por lo tanto, plata). */
export function isAiNode(type: string): boolean {
  return type === 'action.ai_reply' || type === 'logic.ai_route' || type === 'action.handoff_ai';
}

/** Sobre qué líneas actúa un disparador. */
export type PhoneScope = 'all' | 'specific';

/**
 * El alcance de líneas de un disparador.
 *
 * Antes esto se deducía del largo de la lista — vacía significaba "todas" —, y
 * era imposible distinguir "quiero todas" de "todavía no elegí ninguna": las
 * dos se veían igual y las dos publicaban. Ahora la intención se guarda
 * explícita en `phoneScope`; los flujos publicados antes del cambio no lo
 * tienen, así que para esos se sigue deduciendo como antes.
 */
export function phoneScopeOf(data: Record<string, any>): PhoneScope {
  if (data.phoneScope === 'all' || data.phoneScope === 'specific') return data.phoneScope;
  const ids = Array.isArray(data.phoneNumberIds) ? data.phoneNumberIds : [];
  return ids.length > 0 ? 'specific' : 'all';
}

/** Nodos que entran en estado de espera (cortan cualquier ciclo) */
export function isWaitNode(type: string): boolean {
  return (
    type === 'action.send_buttons' ||
    type === 'action.send_list' ||
    type === 'action.ask' ||
    type === 'logic.delay' ||
    type === 'logic.wait_business_hours'
  );
}

/** Nodos terminales: la ejecución termina al procesarlos */
export function isTerminal(type: string): boolean {
  return type === 'action.handoff_ai' || type === 'action.handoff_human';
}

/** Nodos que envían mensajes de sesión (sujetos a la ventana de 24 h) */
export function isSessionSend(type: string): boolean {
  return (
    type === 'action.send_text' ||
    type === 'action.send_media' ||
    type === 'action.send_location' ||
    type === 'action.send_buttons' ||
    type === 'action.send_list' ||
    type === 'action.send_cta_url' ||
    type === 'action.ask' ||
    type === 'action.ai_reply'
  );
}

/** Handles de salida válidos según el tipo y la config del nodo */
export function outputHandles(node: FlowNode): string[] {
  const data = node.data as Record<string, any>;
  switch (node.type) {
    case 'trigger.inbound_message':
    case 'trigger.webhook':
    case 'trigger.campaign_reply':
      return ['out'];
    case 'action.send_text':
    case 'action.send_media':
    case 'action.send_location':
    // El botón con link abre el navegador: no vuelve como respuesta, así que
    // no abre ramas ni entra en espera.
    case 'action.send_cta_url':
      return ['out', 'error'];
    case 'action.send_buttons': {
      const buttons: unknown[] = Array.isArray(data.buttons) ? data.buttons : [];
      return [...buttons.map((_, i) => `btn:${i}`), 'other', 'timeout', 'error'];
    }
    case 'action.send_list': {
      const rows: unknown[] = Array.isArray(data.rows) ? data.rows : [];
      return [...rows.map((_, i) => `row:${i}`), 'other', 'timeout', 'error'];
    }
    case 'action.send_template':
      return ['out', 'error'];
    case 'action.ask':
      return ['reply', 'invalid', 'timeout', 'error'];
    case 'action.ai_reply':
      return ['out', 'handoff', 'error'];
    case 'logic.ai_route': {
      const options: Array<{ key?: string }> = Array.isArray(data.options) ? data.options : [];
      return [...options.map((o) => `opt:${o.key ?? ''}`), 'fallback'];
    }
    case 'action.handoff_ai':
    case 'action.handoff_human':
      return [];
    case 'action.assign_agent':
      return ['out', 'unassigned'];
    case 'action.label':
    case 'action.update_contact':
    case 'action.internal_note':
    case 'action.set_variable':
    case 'action.emit_event':
      return ['out'];
    case 'logic.condition':
      return ['yes', 'no'];
    case 'logic.delay':
    case 'logic.wait_business_hours':
      return ['out'];
    case 'action.http':
      return ['success', 'error'];
    default:
      return [];
  }
}

/** Duración de un delay/timeout en ms a partir de {amount, unit} */
export function durationToMs(duration: { amount?: number; unit?: string } | undefined): number | null {
  if (!duration || typeof duration.amount !== 'number' || duration.amount <= 0) return null;
  const unitMs: Record<string, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  };
  const factor = unitMs[duration.unit ?? ''];
  if (!factor) return null;
  return duration.amount * factor;
}

export const MAX_WAIT_MS = 7 * 86_400_000; // 7 días
export const DEFAULT_REPLY_TIMEOUT_MS = 24 * 3_600_000;
