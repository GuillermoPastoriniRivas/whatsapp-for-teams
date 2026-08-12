import { Module } from '@nestjs/common';
import { MetaCloudApiService } from './meta-cloud-api.service.js';
import { MessagingApiStrategyService } from './messaging-api-strategy.service.js';
import { MetaTemplateApiService } from './meta-template-api.service.js';
import { DemoTemplateApiService } from './demo-template-api.service.js';
import { TemplateManagementStrategyService } from './template-management-strategy.service.js';
import { MetaFlowsApiService } from './meta-flows-api.service.js';
import { DemoFlowsApiService } from './demo-flows-api.service.js';
import { FlowCatalogStrategyService } from './flow-catalog-strategy.service.js';
import { MetaMediaApiService } from './meta-media-api.service.js';
import { MediaProviderStrategyService } from './media-provider-strategy.service.js';
import { MetaBusinessProfileApiService } from './meta-business-profile-api.service.js';
import { DemoBusinessProfileApiService } from './demo-business-profile-api.service.js';
import { BusinessProfileStrategyService } from './business-profile-strategy.service.js';
import { MetaPhoneAdminApiService } from './meta-phone-admin-api.service.js';
import { DemoPhoneAdminApiService } from './demo-phone-admin-api.service.js';
import { PhoneAdminStrategyService } from './phone-admin-strategy.service.js';
import { MetaAnalyticsApiService } from './meta-analytics-api.service.js';
import { DemoAnalyticsApiService } from './demo-analytics-api.service.js';
import { AnalyticsStrategyService } from './analytics-strategy.service.js';
import { LedgeredMessagingApi } from './ledgered-messaging-api.service.js';
import { PersistenceModule } from '../persistence/persistence.module.js';

@Module({
  imports: [PersistenceModule],
  providers: [
    MetaCloudApiService,
    MessagingApiStrategyService,
    MetaTemplateApiService,
    DemoTemplateApiService,
    TemplateManagementStrategyService,
    MetaFlowsApiService,
    DemoFlowsApiService,
    FlowCatalogStrategyService,
    MetaMediaApiService,
    MediaProviderStrategyService,
    MetaBusinessProfileApiService,
    DemoBusinessProfileApiService,
    BusinessProfileStrategyService,
    MetaPhoneAdminApiService,
    DemoPhoneAdminApiService,
    PhoneAdminStrategyService,
    MetaAnalyticsApiService,
    DemoAnalyticsApiService,
    AnalyticsStrategyService,
    // Todo lo que sale pasa por el ledger. Envolver el puerto acá —y no llamar
    // a la contabilidad desde cada caso de uso— es lo que garantiza que no
    // quede ningún envío sin registrar.
    {
      provide: 'MessagingApiPort',
      useFactory: (inner: MessagingApiStrategyService, charges: any) =>
        new LedgeredMessagingApi(inner, charges),
      inject: [MessagingApiStrategyService, 'MessageChargeRepository'],
    },
    { provide: 'TemplateManagementPort', useExisting: TemplateManagementStrategyService },
    { provide: 'FlowCatalogPort', useExisting: FlowCatalogStrategyService },
    { provide: 'MediaProviderPort', useExisting: MediaProviderStrategyService },
    { provide: 'BusinessProfilePort', useExisting: BusinessProfileStrategyService },
    { provide: 'PhoneAdminPort', useExisting: PhoneAdminStrategyService },
    { provide: 'WhatsAppAnalyticsPort', useExisting: AnalyticsStrategyService },
  ],
  exports: [
    'MessagingApiPort',
    'TemplateManagementPort',
    'FlowCatalogPort',
    'MediaProviderPort',
    'BusinessProfilePort',
    'PhoneAdminPort',
    'WhatsAppAnalyticsPort',
  ],
})
export class MessagingModule {}
