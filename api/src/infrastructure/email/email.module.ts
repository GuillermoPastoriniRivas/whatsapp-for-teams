import { Module } from '@nestjs/common';
import { SesEmailService } from './ses-email.service.js';

@Module({
  providers: [
    SesEmailService,
    { provide: 'EmailServicePort', useExisting: SesEmailService },
  ],
  exports: ['EmailServicePort', SesEmailService],
})
export class EmailModule {}
