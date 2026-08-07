import { Module } from '@nestjs/common';
import { MetaCloudApiService } from './meta-cloud-api.service.js';
import { TwilioWhatsAppService } from './twilio-whatsapp.service.js';
import { KapsoWhatsAppService } from './kapso-whatsapp.service.js';
import { MessagingApiStrategyService } from './messaging-api-strategy.service.js';
import { KapsoTemplateApiService, MetaTemplateApiService } from './meta-template-api.service.js';
import { DemoTemplateApiService } from './demo-template-api.service.js';
import { TemplateManagementStrategyService } from './template-management-strategy.service.js';
import { KapsoMediaApiService, MetaMediaApiService } from './meta-media-api.service.js';
import { TwilioMediaApiService } from './twilio-media-api.service.js';
import { MediaProviderStrategyService } from './media-provider-strategy.service.js';
import { KapsoBusinessProfileApiService, MetaBusinessProfileApiService } from './meta-business-profile-api.service.js';
import { DemoBusinessProfileApiService } from './demo-business-profile-api.service.js';
import { BusinessProfileStrategyService } from './business-profile-strategy.service.js';

@Module({
  providers: [
    MetaCloudApiService,
    TwilioWhatsAppService,
    KapsoWhatsAppService,
    MessagingApiStrategyService,
    MetaTemplateApiService,
    KapsoTemplateApiService,
    DemoTemplateApiService,
    TemplateManagementStrategyService,
    MetaMediaApiService,
    KapsoMediaApiService,
    TwilioMediaApiService,
    MediaProviderStrategyService,
    MetaBusinessProfileApiService,
    KapsoBusinessProfileApiService,
    DemoBusinessProfileApiService,
    BusinessProfileStrategyService,
    { provide: 'MessagingApiPort', useExisting: MessagingApiStrategyService },
    { provide: 'TemplateManagementPort', useExisting: TemplateManagementStrategyService },
    { provide: 'MediaProviderPort', useExisting: MediaProviderStrategyService },
    { provide: 'BusinessProfilePort', useExisting: BusinessProfileStrategyService },
  ],
  exports: ['MessagingApiPort', 'TemplateManagementPort', 'MediaProviderPort', 'BusinessProfilePort'],
})
export class MessagingModule {}
