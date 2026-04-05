import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailServicePort, EmailMessage, EmailRecipient } from '../../application/ports/email-service.port.js';

@Injectable()
export class SesEmailService implements EmailServicePort {
  private readonly logger = new Logger(SesEmailService.name);
  private readonly client: SESClient;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo: string;

  constructor(private readonly config: ConfigService) {
    const region = config.get<string>('ses.region')!;
    const accessKeyId = config.get<string>('ses.accessKeyId');
    const secretAccessKey = config.get<string>('ses.secretAccessKey');

    const clientConfig: ConstructorParameters<typeof SESClient>[0] = { region };

    // Use explicit credentials if provided, otherwise fall back to IAM role
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = { accessKeyId, secretAccessKey };
    }

    this.client = new SESClient(clientConfig);
    this.defaultFrom = config.get<string>('ses.fromEmail') ?? 'no-reply@asis.chat';
    this.defaultReplyTo = config.get<string>('ses.replyToEmail') ?? 'contact@asis.chat';
  }

  async send(message: EmailMessage): Promise<void> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const toAddresses = recipients.map((r: EmailRecipient) =>
      r.name ? `${r.name} <${r.email}>` : r.email,
    );

    const command = new SendEmailCommand({
      Source: message.from ?? this.defaultFrom,
      ReplyToAddresses: [message.replyTo ?? this.defaultReplyTo],
      Destination: { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: message.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: message.html, Charset: 'UTF-8' },
          ...(message.text ? { Text: { Data: message.text, Charset: 'UTF-8' } } : {}),
        },
      },
    });

    try {
      await this.client.send(command);
      this.logger.log(`Email sent to ${toAddresses.join(', ')}: "${message.subject}"`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${toAddresses.join(', ')}: ${error}`);
      throw error;
    }
  }
}
