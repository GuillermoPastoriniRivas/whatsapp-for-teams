import { Injectable } from '@nestjs/common';
import type {
  AnalyticsRange,
  ConversationAnalyticsPoint,
  MessagingAnalyticsPoint,
  TemplateAnalyticsPoint,
} from '../../application/ports/whatsapp-analytics.port.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 92;

/**
 * Serie sintética para el tenant demo. Es determinística a propósito —depende
 * del día, no del azar— para que el visitante que recarga vea el mismo gráfico
 * y no sospeche que los números son ruido.
 */
function curve(dayIndex: number, base: number): number {
  const weekly = Math.sin((dayIndex / 7) * Math.PI * 2);
  return Math.max(0, Math.round(base + weekly * base * 0.35 + (dayIndex % 5) * 3));
}

function* days(range: AnalyticsRange): Generator<{ start: Date; end: Date; index: number }> {
  const total = Math.min(MAX_DAYS, Math.ceil((range.end.getTime() - range.start.getTime()) / DAY_MS));
  for (let index = 0; index < total; index++) {
    const start = new Date(range.start.getTime() + index * DAY_MS);
    yield { start, end: new Date(start.getTime() + DAY_MS), index };
  }
}

@Injectable()
export class DemoAnalyticsApiService {
  async getMessagingAnalytics(_ctx: unknown, range: AnalyticsRange): Promise<MessagingAnalyticsPoint[]> {
    return [...days(range)].map(({ start, end, index }) => {
      const sent = curve(index, 120);
      return { start, end, sent, delivered: Math.round(sent * 0.96) };
    });
  }

  async getConversationAnalytics(_ctx: unknown, range: AnalyticsRange): Promise<ConversationAnalyticsPoint[]> {
    const points: ConversationAnalyticsPoint[] = [];
    for (const { start, end, index } of days(range)) {
      for (const [category, base, unit] of [
        ['MARKETING', 40, 0.0625],
        ['UTILITY', 25, 0.0126],
        ['SERVICE', 30, 0],
      ] as const) {
        const conversations = curve(index, base);
        points.push({
          start,
          end,
          conversations,
          cost: Number((conversations * unit).toFixed(4)),
          currency: 'USD',
          category,
        });
      }
    }
    return points;
  }

  async getTemplateAnalytics(
    _ctx: unknown,
    range: AnalyticsRange,
    metaTemplateIds: string[],
  ): Promise<TemplateAnalyticsPoint[]> {
    const points: TemplateAnalyticsPoint[] = [];
    for (const templateId of metaTemplateIds) {
      for (const { start, end, index } of days(range)) {
        const sent = curve(index, 60);
        const delivered = Math.round(sent * 0.95);
        points.push({
          templateId,
          start,
          end,
          sent,
          delivered,
          read: Math.round(delivered * 0.72),
          buttonClicks: [{ label: 'Ver más', type: 'QUICK_REPLY', count: Math.round(delivered * 0.18) }],
        });
      }
    }
    return points;
  }
}
