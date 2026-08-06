import { Module } from '@nestjs/common';
import { SesEmailService } from './ses-email.service.js';
import { InboundMailForwarderService } from './inbound-mail-forwarder.service.js';

@Module({
  providers: [
    SesEmailService,
    InboundMailForwarderService,
    { provide: 'EmailServicePort', useExisting: SesEmailService },
  ],
  exports: ['EmailServicePort', SesEmailService, InboundMailForwarderService],
})
export class EmailModule {}
