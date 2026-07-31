import { DeveloperEventType } from '../../domain/enums/developer-event-type.enum.js';

/**
 * Publicación de eventos hacia los webhooks de desarrolladores.
 *
 * `emit` es fire-and-forget: la implementación resuelve endpoints suscriptos,
 * persiste las entregas y las encola; nunca lanza ni bloquea el caso de uso
 * que emite (un webhook de un tercero jamás puede romper el flujo de
 * mensajería).
 */
export interface DeveloperEventsPort {
  emit(tenantId: string, type: DeveloperEventType, data: Record<string, unknown>): void;
}
