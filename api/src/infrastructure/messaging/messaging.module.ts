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
    { provide: 'MessagingApiPort', useExisting: MessagingApiStrategyService },
    { provide: 'TemplateManagementPort', useExisting: TemplateManagementStrategyService },
    { provide: 'MediaProviderPort', useExisting: MediaProviderStrategyService },
  ],
  exports: ['MessagingApiPort', 'TemplateManagementPort', 'MediaProviderPort'],
})
export class MessagingModule {}
