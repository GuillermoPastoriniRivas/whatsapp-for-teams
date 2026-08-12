import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import type {
  FlowCatalogContext,
  FlowCatalogPort,
  WhatsAppFlowSummary,
} from '../../application/ports/flow-catalog.port.js';
import { MetaFlowsApiService } from './meta-flows-api.service.js';
import { DemoFlowsApiService } from './demo-flows-api.service.js';

@Injectable()
export class FlowCatalogStrategyService implements FlowCatalogPort {
  constructor(
    private readonly metaService: MetaFlowsApiService,
    private readonly demoService: DemoFlowsApiService,
  ) {}

  async listFlows(context: FlowCatalogContext): Promise<WhatsAppFlowSummary[]> {
    switch (context.provider) {
      case MessagingProvider.META:
        return this.metaService.listFlows(context);
      case MessagingProvider.DEMO:
        return this.demoService.listFlows(context);
      default:
        return [];
    }
  }
}
