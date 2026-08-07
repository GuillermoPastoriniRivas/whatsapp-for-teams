import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import {
  AnalyticsContext,
  ConversationAnalyticsPoint,
  MessagingAnalyticsPoint,
  TemplateAnalyticsPoint,
  WhatsAppAnalyticsPort,
} from '../../ports/whatsapp-analytics.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  CrossTenantAccessError,
  WabaNotConfiguredError,
} from '../../../domain/errors/domain-errors.js';

const MAX_RANGE_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AnalyticsQuery {
  tenantId: string;
  phoneId: string;
  start: Date;
  end: Date;
  granularity?: 'DAY' | 'MONTH';
}

export interface WhatsAppAnalyticsView {
  messaging: MessagingAnalyticsPoint[];
  conversations: ConversationAnalyticsPoint[];
  /** `false` = Meta no devolvió datos de costo; no es que el costo sea cero. */
  costAvailable: boolean;
  totals: {
    sent: number;
    delivered: number;
    conversations: number;
    cost: number;
    currency: string | null;
    /** Costo desglosado por categoría facturable de Meta. */
    costByCategory: Array<{ category: string; conversations: number; cost: number }>;
  };
}

/**
 * Analytics de un número: volumen y **costo real**.
 *
 * Nosotros contamos mensajes, Meta factura conversaciones: son unidades
 * distintas. El costo sale siempre de Meta, nunca de nuestros contadores.
 */
export class GetWhatsAppAnalyticsUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly analytics: WhatsAppAnalyticsPort,
  ) {}

  async execute(query: AnalyticsQuery): Promise<Result<WhatsAppAnalyticsView, DomainError>> {
    const ctx = await this.contextFor(query);
    if (!ctx.ok) return err(ctx.error);

    const range = this.clampRange(query);

    const [messaging, conversationsOrNull] = await Promise.all([
      this.analytics.getMessagingAnalytics(ctx.value, range),
      this.analytics.getConversationAnalytics(ctx.value, range),
    ]);

    // Meta omite el campo cuando la cuenta no tiene analíticas de conversación:
    // eso NO es "costo cero", y mostrarlo como cero sería mentir.
    const costAvailable = conversationsOrNull !== null;
    const conversations = conversationsOrNull ?? [];

    const byCategory = new Map<string, { conversations: number; cost: number }>();
    for (const point of conversations) {
      const key = point.category ?? 'UNKNOWN';
      const current = byCategory.get(key) ?? { conversations: 0, cost: 0 };
      byCategory.set(key, {
        conversations: current.conversations + point.conversations,
        cost: current.cost + point.cost,
      });
    }

    return ok({
      messaging,
      conversations,
      costAvailable,
      totals: {
        sent: messaging.reduce((total, point) => total + point.sent, 0),
        delivered: messaging.reduce((total, point) => total + point.delivered, 0),
        conversations: conversations.reduce((total, point) => total + point.conversations, 0),
        cost: Number(conversations.reduce((total, point) => total + point.cost, 0).toFixed(4)),
        currency: conversations.find((point) => point.currency)?.currency ?? null,
        costByCategory: [...byCategory.entries()].map(([category, value]) => ({
          category,
          conversations: value.conversations,
          cost: Number(value.cost.toFixed(4)),
        })),
      },
    });
  }

  private async contextFor(query: AnalyticsQuery): Promise<Result<AnalyticsContext, DomainError>> {
    const phone = await this.phoneRepo.findById(query.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== query.tenantId) return err(new CrossTenantAccessError());
    if (!phone.wabaId) return err(new WabaNotConfiguredError());

    return ok({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      wabaId: phone.wabaId,
    });
  }

  /** Meta rechaza rangos largos; se recorta acá con un tope explícito. */
  private clampRange(query: AnalyticsQuery) {
    const end = query.end;
    const earliest = new Date(end.getTime() - MAX_RANGE_DAYS * DAY_MS);
    return {
      start: query.start < earliest ? earliest : query.start,
      end,
      granularity: query.granularity ?? ('DAY' as const),
    };
  }
}

/** Rendimiento por plantilla: entregas, lecturas y clics por botón. */
export class GetTemplateAnalyticsUseCase {
  constructor(
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly analytics: WhatsAppAnalyticsPort,
  ) {}

  async execute(
    query: AnalyticsQuery & { templateIds?: string[] },
  ): Promise<Result<TemplateAnalyticsPoint[], DomainError>> {
    const phone = await this.phoneRepo.findById(query.phoneId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== query.tenantId) return err(new CrossTenantAccessError());
    if (!phone.wabaId) return err(new WabaNotConfiguredError());

    // Meta pide sus propios ids, no los nuestros. Una plantilla que todavía no
    // sincronizó no tiene `metaTemplateId` y no se puede consultar.
    // Se filtra por WABA, no por número: en Meta las plantillas son de la cuenta.
    const templates = await this.templateRepo.findByFilters({
      tenantId: query.tenantId,
      wabaId: phone.wabaId,
      page: 1,
      limit: 100,
    });

    const wanted = new Set(query.templateIds ?? []);
    const metaIds = templates.data
      .filter((template) => (wanted.size === 0 || wanted.has(template.id)) && template.metaTemplateId)
      .map((template) => template.metaTemplateId!)
      .slice(0, 10); // Meta acepta hasta 10 plantillas por consulta.

    if (metaIds.length === 0) return ok([]);

    const points = await this.analytics.getTemplateAnalytics(
      { provider: phone.provider, providerConfig: phone.providerConfig, wabaId: phone.wabaId },
      { start: query.start, end: query.end },
      metaIds,
    );

    return ok(points);
  }
}
