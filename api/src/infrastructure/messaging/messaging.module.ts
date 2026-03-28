import { Module } from '@nestjs/common';
import { MetaCloudApiService } from './meta-cloud-api.service.js';
import { TwilioWhatsAppService } from './twilio-whatsapp.service.js';
import { MessagingApiStrategyService } from './messaging-api-strategy.service.js';

@Module({
  providers: [
    MetaCloudApiService,
    TwilioWhatsAppService,
    MessagingApiStrategyService,
    { provide: 'MessagingApiPort', useExisting: MessagingApiStrategyService },
  ],
  exports: ['MessagingApiPort'],
})
export class MessagingModule {}
