import type { FlowGraph } from './flow.entity.js';

/**
 * Trigger denormalizado de la versión publicada, para matchear mensajes
 * entrantes sin parsear el grafo completo.
 */
export interface FlowTriggerIndex {
  type: 'inbound_message' | 'webhook' | 'campaign_reply';
  /** Vacío = todas las líneas del tenant */
  phoneNumberIds: string[];
  match: 'any' | 'keywords';
  keywords: string[];
  keywordMode: 'exact' | 'contains';
  onlyNewConversations: boolean;
  ignoreIfAssignedToHuman: boolean;
  /** Solo trigger.webhook: dot-path del teléfono en el payload */
  contactPhoneField: string | null;
  contactNameField: string | null;
  /** Solo trigger.campaign_reply: campañas que disparan (vacío = todas) */
  campaignIds: string[];
}

/** Snapshot inmutable de un grafo publicado. Las ejecuciones lo fijan por id. */
export class FlowVersion {
  constructor(
    public readonly id: string,
    public readonly flowId: string,
    public readonly tenantId: string,
    public readonly version: number,
    public readonly graph: FlowGraph,
    public readonly trigger: FlowTriggerIndex,
    public readonly publishedByAgentId: string,
    public readonly createdAt: Date,
  ) {}
}
