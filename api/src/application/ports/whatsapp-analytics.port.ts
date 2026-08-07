import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

export interface AnalyticsContext {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  wabaId: string;
}

export interface AnalyticsRange {
  start: Date;
  end: Date;
  /** Meta usa HALF_HOUR | DAY | MONTH para mensajería y DAILY | MONTHLY para conversaciones. */
  granularity?: 'DAY' | 'MONTH';
  /** Números a incluir (`phone_number_id`). Vacío = todos los de la WABA. */
  phoneNumberIds?: string[];
}

/** Volumen de mensajes: lo que se mandó y lo que llegó. */
export interface MessagingAnalyticsPoint {
  start: Date;
  end: Date;
  sent: number;
  delivered: number;
}

/**
 * Conversaciones facturables con su costo. Es la única fuente para responderle
 * al cliente "cuánto me salió esta campaña": nosotros contamos mensajes, Meta
 * factura conversaciones.
 */
export interface ConversationAnalyticsPoint {
  start: Date;
  end: Date;
  conversations: number;
  cost: number;
  currency: string | null;
  /** MARKETING | UTILITY | AUTHENTICATION | SERVICE, cuando se pide desglose. */
  category: string | null;
}

/** Rendimiento por plantilla: entrega, lectura y clics por botón. */
export interface TemplateAnalyticsPoint {
  templateId: string;
  start: Date;
  end: Date;
  sent: number;
  delivered: number;
  read: number;
  /** Clics por botón, en el orden en que están en la plantilla. */
  buttonClicks: Array<{ label: string; type: string; count: number }>;
}

export interface WhatsAppAnalyticsPort {
  getMessagingAnalytics(ctx: AnalyticsContext, range: AnalyticsRange): Promise<MessagingAnalyticsPoint[]>;
  /**
   * `null` = Meta **no devolvió el campo**, que no es lo mismo que cero. Pasa
   * cuando la cuenta no tiene analíticas de conversación habilitadas o no hubo
   * ninguna facturable en el rango; mostrar "costo 0" ahí sería mentir.
   */
  getConversationAnalytics(ctx: AnalyticsContext, range: AnalyticsRange): Promise<ConversationAnalyticsPoint[] | null>;
  getTemplateAnalytics(
    ctx: AnalyticsContext,
    range: AnalyticsRange,
    metaTemplateIds: string[],
  ): Promise<TemplateAnalyticsPoint[]>;
}
