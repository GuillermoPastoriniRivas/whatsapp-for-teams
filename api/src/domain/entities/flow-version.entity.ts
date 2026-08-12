import type { FlowGraph } from './flow.entity.js';

/** Quién está del otro lado de un mensaje entrante. */
export type SenderType = 'nuevo' | 'recurrente';

export const SENDER_TYPES: SenderType[] = ['nuevo', 'recurrente'];

export type AdScope = 'any' | 'from_ads' | 'specific';

export const AD_SCOPES: AdScope[] = ['any', 'from_ads', 'specific'];

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
  /**
   * Quién escribe. Vacío = cualquiera. 'nuevo' es quien nunca escribió a esta
   * línea; 'recurrente', el resto. Deja tener un flujo de bienvenida y otro
   * para conocidos sobre el mismo número, ordenados por prioridad.
   */
  senderTypes: SenderType[];
  /** Etiquetas de la conversación. Vacío = cualquiera; si hay, basta con una. */
  senderLabelIds: string[];
  adScope: AdScope;
  adSourceIds: string[];
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
