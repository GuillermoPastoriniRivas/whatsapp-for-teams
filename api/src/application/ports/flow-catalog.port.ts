import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

/**
 * Un Flow de WhatsApp tal como lo devuelve Meta. No los creamos nosotros: se
 * arman en el editor de WhatsApp Manager y acá se eligen para mandarlos.
 */
export interface WhatsAppFlowSummary {
  id: string;
  name: string;
  /** DRAFT · PUBLISHED · DEPRECATED · BLOCKED · THROTTLED */
  status: string;
  categories: string[];
  /** Un Flow con endpoint hace intercambio de datos; sin él es un formulario que se completa solo. */
  hasEndpoint: boolean;
  /** Pantallas declaradas en su JSON, para poder elegir por dónde entrar. */
  screens: string[];
}

export interface FlowCatalogContext {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  wabaId: string;
}

export interface FlowCatalogPort {
  listFlows(context: FlowCatalogContext): Promise<WhatsAppFlowSummary[]>;
}
