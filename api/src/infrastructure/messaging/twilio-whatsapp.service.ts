import { Injectable, Logger } from '@nestjs/common';
import { SendMessageParams, SendMessageResult } from '../../application/ports/messaging-api.port.js';

@Injectable()
export class TwilioWhatsAppService {
  private readonly logger = new Logger(TwilioWhatsAppService.name);

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const { accountSid, authToken, fromNumber } = params.providerConfig;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio: missing accountSid, authToken, or fromNumber in providerConfig');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formBody = new URLSearchParams({
      To: `whatsapp:+${params.to}`,
      From: `whatsapp:${fromNumber}`,
      Body: params.body ?? '',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: formBody.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Twilio API error: ${response.status} ${error}`);
      throw new Error(`Twilio API error: ${response.status}`);
    }

    const data = (await response.json()) as { sid: string };

    return { waMessageId: data.sid };
  }
}
