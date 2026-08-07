import { Module } from '@nestjs/common';
import { MetaCloudApiService } from './meta-cloud-api.service.js';
import { MessagingApiStrategyService } from './messaging-api-strategy.service.js';
import { MetaTemplateApiService } from './meta-template-api.service.js';
import { DemoTemplateApiService } from './demo-template-api.service.js';
import { TemplateManagementStrategyService } from './template-management-strategy.service.js';
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

@Module({
  providers: [
    MetaCloudApiService,
    MessagingApiStrategyService,
    MetaTemplateApiService,
    DemoTemplateApiService,
    TemplateManagementStrategyService,
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
    { provide: 'MessagingApiPort', useExisting: MessagingApiStrategyService },
    { provide: 'TemplateManagementPort', useExisting: TemplateManagementStrategyService },
    { provide: 'MediaProviderPort', useExisting: MediaProviderStrategyService },
    { provide: 'BusinessProfilePort', useExisting: BusinessProfileStrategyService },
    { provide: 'PhoneAdminPort', useExisting: PhoneAdminStrategyService },
    { provide: 'WhatsAppAnalyticsPort', useExisting: AnalyticsStrategyService },
  ],
  exports: [
    'MessagingApiPort',
    'TemplateManagementPort',
    'MediaProviderPort',
    'BusinessProfilePort',
    'PhoneAdminPort',
    'WhatsAppAnalyticsPort',
  ],
})
export class MessagingModule {}
