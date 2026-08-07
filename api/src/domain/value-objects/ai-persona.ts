// ── La persona del asistente, resuelta ───────────────────────────
// Lo que el runtime de IA necesita para contestar un mensaje. Se arma en el
// momento a partir de dos fuentes:
//
//   · el negocio  → de la cuenta (Tenant): nombre, rubro, catálogo, horarios
//   · la conducta → del nodo del flujo: objetivo, tono, derivación, límites
//
// Antes todo esto era una fila de `ai_agent_configs` colgada de un agente IA,
// y ese agente competía en el reparto de conversaciones como si fuera una
// persona. Desde ago-2026 el bot no es una identidad asignable: es un nodo de
// una automatización, y esta es su config resuelta.

import type { BusinessHours, BusinessProfile } from './business-profile.js';

export interface BotBehavior {
  language: string; // 'es', 'en', 'pt', …
  formality: 'informal' | 'formal';
  useEmojis: boolean;
  /** Objetivo de la conversación, en una línea */
  goal: string;
  /** Escape hatch para lo que no entra en los campos de arriba */
  customInstructions: string;
}

export interface HandoffRules {
  keywords: string[];
  maxConsecutiveFailures: number;
  onCustomerRequest: boolean;
  urgencyKeywords: string[];
}

export interface AiContextConfig {
  maxHistoryMessages: number;
  includeContactInfo: boolean;
}

/** Tope diario de la cuenta, no del nodo: es un guardarraíl de gasto. */
export interface AiRateLimits {
  maxMessagesPerDay: number;
  maxTokensPerDay: number;
}

export interface AiMultiMessageConfig {
  enabled: boolean;
  maxBubbles: number;
  interBubbleDelayMs: number;
  debounceWindowMs: number;
  debounceMaxWaitMs: number;
}

/** Config completa con la que corre un turno de IA. */
export interface AiPersona {
  /** Cómo se muestra en el chat el mensaje que manda. */
  name: string;
  businessProfile: BusinessProfile;
  behavior: BotBehavior;
  handoffRules: HandoffRules;
  contextConfig: AiContextConfig;
  multiMessage: AiMultiMessageConfig;
  timezone: string | null;
  businessHours: BusinessHours | null;
}

export const DEFAULT_BEHAVIOR: BotBehavior = {
  language: 'es',
  formality: 'informal',
  useEmojis: true,
  goal: '',
  customInstructions: '',
};

export const DEFAULT_HANDOFF_RULES: HandoffRules = {
  keywords: [],
  maxConsecutiveFailures: 3,
  onCustomerRequest: true,
  urgencyKeywords: [],
};

export const DEFAULT_CONTEXT_CONFIG: AiContextConfig = {
  maxHistoryMessages: 20,
  includeContactInfo: true,
};

export const DEFAULT_MULTI_MESSAGE: AiMultiMessageConfig = {
  enabled: true,
  maxBubbles: 3,
  interBubbleDelayMs: 1200,
  debounceWindowMs: 2000,
  debounceMaxWaitMs: 20000,
};

export const DEFAULT_AI_RATE_LIMITS: AiRateLimits = {
  maxMessagesPerDay: 0, // 0 = sin tope
  maxTokensPerDay: 0,
};

/** Lo que la cuenta aporta a la persona. */
export interface TenantAiContext {
  businessProfile: BusinessProfile;
  timezone: string | null;
  businessHours: BusinessHours | null;
}

/**
 * Arma la persona con la que corre un nodo de IA.
 *
 * Es tolerante a propósito: un nodo publicado hace meses puede no tener todos
 * los campos, y un turno de IA nunca debe caerse por eso — se completa con los
 * defaults y contesta igual.
 */
export function resolveAiPersona(tenant: TenantAiContext, nodeData: Record<string, any>): AiPersona {
  const behavior = (nodeData.behavior ?? {}) as Partial<BotBehavior>;
  const handoff = (nodeData.handoffRules ?? {}) as Partial<HandoffRules>;
  const context = (nodeData.contextConfig ?? {}) as Partial<AiContextConfig>;
  const multi = (nodeData.multiMessage ?? {}) as Partial<AiMultiMessageConfig>;

  return {
    name: typeof nodeData.name === 'string' && nodeData.name.trim() ? nodeData.name.trim() : 'Asistente',
    businessProfile: tenant.businessProfile,
    timezone: tenant.timezone,
    businessHours: tenant.businessHours,
    behavior: {
      language: behavior.language ?? DEFAULT_BEHAVIOR.language,
      formality: behavior.formality ?? DEFAULT_BEHAVIOR.formality,
      useEmojis: behavior.useEmojis ?? DEFAULT_BEHAVIOR.useEmojis,
      // `instructions` es el campo que ya usaba el nodo "Respuesta IA" para el
      // texto libre: se respeta para no romper los flujos publicados.
      goal: behavior.goal ?? (typeof nodeData.goal === 'string' ? nodeData.goal : DEFAULT_BEHAVIOR.goal),
      customInstructions:
        behavior.customInstructions ??
        (typeof nodeData.instructions === 'string' ? nodeData.instructions : DEFAULT_BEHAVIOR.customInstructions),
    },
    handoffRules: {
      keywords: handoff.keywords ?? DEFAULT_HANDOFF_RULES.keywords,
      maxConsecutiveFailures: handoff.maxConsecutiveFailures ?? DEFAULT_HANDOFF_RULES.maxConsecutiveFailures,
      onCustomerRequest: handoff.onCustomerRequest ?? DEFAULT_HANDOFF_RULES.onCustomerRequest,
      urgencyKeywords: handoff.urgencyKeywords ?? DEFAULT_HANDOFF_RULES.urgencyKeywords,
    },
    contextConfig: {
      maxHistoryMessages: context.maxHistoryMessages ?? DEFAULT_CONTEXT_CONFIG.maxHistoryMessages,
      includeContactInfo: context.includeContactInfo ?? DEFAULT_CONTEXT_CONFIG.includeContactInfo,
    },
    multiMessage: {
      enabled: multi.enabled ?? DEFAULT_MULTI_MESSAGE.enabled,
      maxBubbles: multi.maxBubbles ?? DEFAULT_MULTI_MESSAGE.maxBubbles,
      interBubbleDelayMs: multi.interBubbleDelayMs ?? DEFAULT_MULTI_MESSAGE.interBubbleDelayMs,
      debounceWindowMs: multi.debounceWindowMs ?? DEFAULT_MULTI_MESSAGE.debounceWindowMs,
      debounceMaxWaitMs: multi.debounceMaxWaitMs ?? DEFAULT_MULTI_MESSAGE.debounceMaxWaitMs,
    },
  };
}
