import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { InboundMailForwarderService } from '../email/inbound-mail-forwarder.service.js';
import type { EmailServicePort, EmailMessage } from '../../application/ports/email-service.port.js';

export const SEND_EMAIL_JOB = 'email.send';
export const FORWARD_INBOUND_MAIL_JOB = 'email.forward-inbound';

@Injectable()
export class EmailJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('EmailServicePort') private readonly emailService: EmailServicePort,
    private readonly inboundForwarder: InboundMailForwarderService,
  ) {}

  onModuleInit(): void {
    this.queue.define(SEND_EMAIL_JOB, async (data) => {
      const message = data as EmailMessage;
      this.logger.debug(`Sending email: "${message.subject}"`);
      await this.emailService.send(message);
    }, 3);

    if (!this.inboundForwarder.enabled) return;

    // Concurrencia 1: dos corridas en paralelo leerían la misma tanda de S3 y
    // el mismo mail saldría duplicado.
    this.queue.define(FORWARD_INBOUND_MAIL_JOB, async () => {
      const forwarded = await this.inboundForwarder.forwardPending();
      if (forwarded) this.logger.log(`${forwarded} correo(s) entrante(s) reenviado(s)`);
    }, 1);

    void this.queue.every('1 minute', FORWARD_INBOUND_MAIL_JOB).catch((error) => {
      this.logger.error(`No se pudo agendar el reenvío de correo entrante: ${error?.message}`);
    });
  }
}
