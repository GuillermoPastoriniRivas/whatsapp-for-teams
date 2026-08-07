// ── La automatización base de un número ──────────────────────────
// Todo mensaje entrante lo rutea una automatización. Para que eso sea cierto
// desde el minuto cero, cada número nace con la suya: el disparador acotado a
// ese número y una sola acción, "quién atiende".
//
// El grafo por defecto (`handoff_human`) hace exactamente lo mismo que hacía
// el auto-assign del webhook antes de que esto existiera — repartir entre el
// equipo por carga. La diferencia es que ahora se ve y se edita.

import type { FlowGraph } from '../../../domain/entities/flow.entity.js';

/**
 * Las base evalúan últimas, siempre. Un flujo común nace con
 * `maxPriority + 10` (ver CreateFlowUseCase) y nunca se acerca a este número,
 * así que cualquier automatización que arme el tenant intercepta primero.
 */
export const DEFAULT_FLOW_PRIORITY = 1_000_000;

/** Quién atiende cuando ninguna otra automatización agarró el mensaje. */
export type DefaultResponder =
  | { kind: 'team' }
  | { kind: 'ai'; aiAgentId: string };

export function defaultFlowName(phoneLabel: string): string {
  return `Atención de ${phoneLabel}`.substring(0, 80);
}

export const DEFAULT_FLOW_DESCRIPTION =
  'Decide quién atiende los chats nuevos de este número cuando ninguna otra automatización los agarra.';

/**
 * El grafo base. `onlyNewConversations` va en true a propósito: replica el
 * `needsAssignment` del pipeline viejo, que solo asignaba al crear la
 * conversación. Sin eso el flujo reasignaría en cada mensaje entrante.
 */
export function buildDefaultPhoneFlowGraph(phoneNumberId: string, responder: DefaultResponder): FlowGraph {
  const handoff =
    responder.kind === 'ai'
      ? { type: 'action.handoff_ai', data: { aiAgentId: responder.aiAgentId } as Record<string, unknown> }
      : { type: 'action.handoff_human', data: { note: '' } as Record<string, unknown> };

  return {
    nodes: [
      {
        id: 'trigger',
        type: 'trigger.inbound_message',
        position: { x: 80, y: 200 },
        data: {
          phoneScope: 'specific',
          phoneNumberIds: [phoneNumberId],
          match: 'any',
          keywords: [],
          keywordMode: 'contains',
          onlyNewConversations: true,
          ignoreIfAssignedToHuman: true,
        },
      },
      {
        id: 'responder',
        type: handoff.type,
        position: { x: 420, y: 200 },
        data: handoff.data,
      },
    ],
    edges: [{ id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'responder' }],
  };
}
