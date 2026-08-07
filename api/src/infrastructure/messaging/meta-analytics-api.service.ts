import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AnalyticsContext,
  AnalyticsRange,
  ConversationAnalyticsPoint,
  MessagingAnalyticsPoint,
  TemplateAnalyticsPoint,
} from '../../application/ports/whatsapp-analytics.port.js';
import { classifyMetaError, MetaApiError, MetaErrorBody } from './meta-api-error.js';

/**
 * Subcódigo de Meta para "Template Insights have not been enabled for this
 * WhatsApp Business Account". Se prende en WhatsApp Manager, no por API.
 *
 * Se compara por subcódigo y no por texto porque en este error el detalle viene
 * en un `error_data` que es **string**, no el objeto `{details}` habitual: el
 * `message` queda en "An unknown error occurred" y no sirve para reconocerlo.
 */
const TEMPLATE_INSIGHTS_DISABLED = 4182004;

function isTemplateInsightsDisabled(error: unknown): boolean {
  return error instanceof MetaApiError && error.subcode === TEMPLATE_INSIGHTS_DISABLED;
}

/** Meta trabaja en epoch en segundos. */
const toEpoch = (date: Date): number => Math.floor(date.getTime() / 1000);
const fromEpoch = (seconds: unknown): Date =>
  new Date((typeof seconds === 'number' ? seconds : Number(seconds) || 0) * 1000);

interface MetaAnalyticsResponse {
  analytics?: { data_points?: Array<{ start?: number; end?: number; sent?: number; delivered?: number }> };
}

interface MetaConversationAnalyticsResponse {
  conversation_analytics?: {
    data?: Array<{
      data_points?: Array<{
        start?: number;
        end?: number;
        conversation?: number;
        cost?: number;
        conversation_category?: string;
      }>;
    }>;
  };
}

interface MetaTemplateAnalyticsResponse {
  data?: Array<{
    data_points?: Array<{
      template_id?: string | number;
      start?: number;
      end?: number;
      sent?: number;
      delivered?: number;
      read?: number;
      clicked?: Array<{ type?: string; button_content?: string; count?: number }>;
    }>;
  }>;
}

/**
 * Analytics de la WABA contra la Business Management API.
 *
 * Nosotros contamos mensajes; **Meta factura conversaciones**. Por eso el costo
 * sale de `conversation_analytics` y no de nuestros propios contadores: son dos
 * unidades distintas y mezclarlas da un número que no le cierra a nadie.
 */
@Injectable()
export class MetaAnalyticsApiService {
  private readonly logger = new Logger(MetaAnalyticsApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  private baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  async getMessagingAnalytics(
    ctx: AnalyticsContext,
    range: AnalyticsRange,
  ): Promise<MessagingAnalyticsPoint[]> {
    const phones = this.phoneFilter(range);
    const field =
      `analytics.start(${toEpoch(range.start)}).end(${toEpoch(range.end)})` +
      `.granularity(${range.granularity ?? 'DAY'})${phones}`;

    const data = await this.request<MetaAnalyticsResponse>(ctx, `/${ctx.wabaId}?fields=${field}`);

    return (data.analytics?.data_points ?? []).map((point) => ({
      start: fromEpoch(point.start),
      end: fromEpoch(point.end),
      sent: point.sent ?? 0,
      delivered: point.delivered ?? 0,
    }));
  }

  async getConversationAnalytics(
    ctx: AnalyticsContext,
    range: AnalyticsRange,
  ): Promise<ConversationAnalyticsPoint[] | null> {
    const phones = this.phoneFilter(range);
    // `CONVERSATION_CATEGORY` es lo que permite separar marketing de utilidad,
    // que es la pregunta real del cliente: en qué se le va la plata.
    const field =
      `conversation_analytics.start(${toEpoch(range.start)}).end(${toEpoch(range.end)})` +
      `.granularity(${range.granularity === 'MONTH' ? 'MONTHLY' : 'DAILY'})${phones}` +
      `.dimensions(["CONVERSATION_CATEGORY"])`;

    const data = await this.request<MetaConversationAnalyticsResponse>(ctx, `/${ctx.wabaId}?fields=${field}`);

    // Meta **omite el campo entero** cuando no hay analíticas de conversación
    // para la cuenta, en vez de devolver una lista vacía. Verificado contra la
    // API real: se distingue de "cero conversaciones" para no inventar un costo.
    if (!data.conversation_analytics) return null;

    const points: ConversationAnalyticsPoint[] = [];
    for (const bucket of data.conversation_analytics?.data ?? []) {
      for (const point of bucket.data_points ?? []) {
        points.push({
          start: fromEpoch(point.start),
          end: fromEpoch(point.end),
          conversations: point.conversation ?? 0,
          cost: point.cost ?? 0,
          // Meta no devuelve la moneda en este endpoint: cuelga de la línea de
          // crédito de la cuenta. Se deja explícito en vez de inventar 'USD'.
          currency: null,
          category: point.conversation_category ?? null,
        });
      }
    }
    return points;
  }

  async getTemplateAnalytics(
    ctx: AnalyticsContext,
    range: AnalyticsRange,
    metaTemplateIds: string[],
  ): Promise<TemplateAnalyticsPoint[]> {
    if (metaTemplateIds.length === 0) return [];

    const params = new URLSearchParams({
      start: String(toEpoch(range.start)),
      end: String(toEpoch(range.end)),
      granularity: 'DAILY',
      metric_types: '["SENT","DELIVERED","READ","CLICKED"]',
      template_ids: JSON.stringify(metaTemplateIds),
    });

    let data: MetaTemplateAnalyticsResponse;
    try {
      data = await this.request<MetaTemplateAnalyticsResponse>(
        ctx,
        `/${ctx.wabaId}/template_analytics?${params.toString()}`,
      );
    } catch (error) {
      // Las insights de plantillas son un interruptor que el dueño de la WABA
      // prende en WhatsApp Manager; hasta entonces Meta responde 4182004. No es
      // un fallo nuestro y no debe tumbar la pantalla de métricas.
      if (isTemplateInsightsDisabled(error)) {
        this.logger.warn(
          `Insights de plantillas deshabilitadas en la WABA ${ctx.wabaId}: hay que activarlas en WhatsApp Manager`,
        );
        return [];
      }
      throw error;
    }

    const points: TemplateAnalyticsPoint[] = [];
    for (const bucket of data.data ?? []) {
      for (const point of bucket.data_points ?? []) {
        points.push({
          templateId: String(point.template_id ?? ''),
          start: fromEpoch(point.start),
          end: fromEpoch(point.end),
          sent: point.sent ?? 0,
          delivered: point.delivered ?? 0,
          read: point.read ?? 0,
          buttonClicks: (point.clicked ?? []).map((click) => ({
            label: click.button_content ?? '',
            type: click.type ?? '',
            count: click.count ?? 0,
          })),
        });
      }
    }
    return points;
  }

  /** Vacío = todos los números de la WABA. */
  private phoneFilter(range: AnalyticsRange): string {
    if (!range.phoneNumberIds?.length) return '';
    return `.phone_numbers(${JSON.stringify(range.phoneNumberIds)})`;
  }

  private async request<T>(ctx: AnalyticsContext, path: string): Promise<T> {
    const accessToken = ctx.providerConfig.accessToken;
    if (!accessToken) throw new Error('Meta Analytics API: falta accessToken en providerConfig');

    const response = await fetch(`${this.baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Meta analytics GET ${path}: ${response.status} ${text.slice(0, 300)}`);
      let errorBody: MetaErrorBody | null = null;
      try {
        errorBody = JSON.parse(text) as MetaErrorBody;
      } catch {
        // cuerpo no-JSON (proxy/HTML): se clasifica solo por el status
      }
      throw classifyMetaError(response.status, errorBody);
    }

    return (await response.json()) as T;
  }
}
