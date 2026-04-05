import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import type { EmailServicePort, EmailMessage } from '../../application/ports/email-service.port.js';

export const SEND_EMAIL_JOB = 'email.send';

@Injectable()
export class EmailJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('EmailServicePort') private readonly emailService: EmailServicePort,
  ) {}

  onModuleInit(): void {
    this.queue.define(SEND_EMAIL_JOB, async (data) => {
      const message = data as EmailMessage;
      this.logger.debug(`Sending email: "${message.subject}"`);
      await this.emailService.send(message);
    }, 3);
  }
}
