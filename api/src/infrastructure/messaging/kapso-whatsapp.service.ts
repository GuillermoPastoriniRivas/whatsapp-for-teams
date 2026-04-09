import { Injectable, Logger } from '@nestjs/common';
import { SendMessageParams, SendMessageResult } from '../../application/ports/messaging-api.port.js';

@Injectable()
export class KapsoWhatsAppService {
  private readonly logger = new Logger(KapsoWhatsAppService.name);
  private readonly baseUrl = 'https://api.kapso.ai/meta/whatsapp';

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const apiKey = params.providerConfig.apiKey;
    if (!apiKey) {
      throw new Error('Kapso: missing apiKey in providerConfig');
    }

    const url = `${this.baseUrl}/v24.0/${params.phoneNumberId}/messages`;

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: params.type,
    };

    if (params.type === 'text' && params.body) {
      body.text = { body: params.body };
    } else if (params.type === 'image' && params.mediaUrl) {
      const image: Record<string, string> = { link: params.mediaUrl };
      if (params.body) image.caption = params.body;
      body.image = image;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Kapso API error: ${response.status} ${error}`);
      throw new Error(`Kapso API error: ${response.status}`);
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> };

    return { waMessageId: data.messages[0].id };
  }
}
