import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import type {
  AnalyticsContext,
  AnalyticsRange,
  ConversationAnalyticsPoint,
  MessagingAnalyticsPoint,
  TemplateAnalyticsPoint,
  WhatsAppAnalyticsPort,
} from '../../application/ports/whatsapp-analytics.port.js';
import { MetaAnalyticsApiService } from './meta-analytics-api.service.js';
import { DemoAnalyticsApiService } from './demo-analytics-api.service.js';

@Injectable()
export class AnalyticsStrategyService implements WhatsAppAnalyticsPort {
  constructor(
    private readonly metaService: MetaAnalyticsApiService,
    private readonly demoService: DemoAnalyticsApiService,
  ) {}

  getMessagingAnalytics(ctx: AnalyticsContext, range: AnalyticsRange): Promise<MessagingAnalyticsPoint[]> {
    return this.resolve(ctx).getMessagingAnalytics(ctx, range);
  }

  getConversationAnalytics(
    ctx: AnalyticsContext,
    range: AnalyticsRange,
  ): Promise<ConversationAnalyticsPoint[] | null> {
    return this.resolve(ctx).getConversationAnalytics(ctx, range);
  }

  getTemplateAnalytics(
    ctx: AnalyticsContext,
    range: AnalyticsRange,
    metaTemplateIds: string[],
  ): Promise<TemplateAnalyticsPoint[]> {
    return this.resolve(ctx).getTemplateAnalytics(ctx, range, metaTemplateIds);
  }

  private resolve(ctx: AnalyticsContext): MetaAnalyticsApiService | DemoAnalyticsApiService {
    return ctx.provider === MessagingProvider.META ? this.metaService : this.demoService;
  }
}
