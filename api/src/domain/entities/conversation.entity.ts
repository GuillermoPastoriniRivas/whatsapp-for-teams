import { ConversationStatus } from '../enums/conversation-status.enum.js';
import { ConversationOrigin } from '../enums/conversation-origin.enum.js';
import type { ConversationAttribution } from '../value-objects/message-referral.js';

/** Por qué se apagó el piloto. Se muestra en el chat para poder retomarlo. */
export type AutopilotPausedReason = 'agent_reply' | 'manual';

/**
 * Piloto automático de la conversación: si las automatizaciones pueden actuar
 * sobre este chat o no.
 *
 * Es un eje distinto del de `agentId`. Antes los dos vivían en el mismo campo:
 * asignarle el chat a una persona era la única forma de frenar al bot, y era
 * irreversible porque la ejecución se cancelaba. Ahora "quién es responsable"
 * y "está corriendo el piloto" se prenden y apagan por separado.
 */
export interface ConversationAutopilot {
  enabled: boolean;
  pausedReason: AutopilotPausedReason | null;
  pausedAt: Date | null;
  /**
   * Nodo de IA que quedó atendiendo el chat de corrido, puesto por el nodo
   * "Entregar al asistente IA". Reemplaza al viejo `agentId = <bot>`: apunta a
   * una versión publicada, que es inmutable, así que la config con la que
   * contesta no cambia bajo los pies aunque editen el flujo.
   */
  aiNode: AutopilotAiNode | null;
}

/** Puntero al nodo de IA que maneja la conversación. */
export interface AutopilotAiNode {
  flowId: string;
  flowVersionId: string;
  nodeId: string;
}

export const AUTOPILOT_ON: ConversationAutopilot = {
  enabled: true,
  pausedReason: null,
  pausedAt: null,
  aiNode: null,
};

export class Conversation {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly phoneNumberId: string,
    public readonly contactId: string,
    public readonly agentId: string | null,
    public readonly status: ConversationStatus,
    public readonly lastMessageAt: Date,
    public readonly lastInboundAt: Date,
    public readonly createdAt: Date,
    public readonly resolvedAt: Date | null,
    public readonly closedBy: string | null,
    public readonly summary: string | null = null,
    public readonly pendingAiSince: Date | null = null,
    public readonly origin: ConversationOrigin = ConversationOrigin.INBOUND,
    public readonly hasReplied: boolean = true,
    public readonly repliedAt: Date | null = null,
    /** Mensajes entrantes sin leer; se resetea cuando un agente abre la conversación */
    public readonly unreadCount: number = 0,
    /** Prendido salvo que alguien lo apague o intervenga escribiendo. */
    public readonly autopilot: ConversationAutopilot = AUTOPILOT_ON,
    public readonly attribution: ConversationAttribution | null = null,
  ) {}
}
