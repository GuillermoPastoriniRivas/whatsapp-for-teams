import { Injectable, Logger } from '@nestjs/common';
import { SendMessageParams, SendMessageResult, TypingIndicatorParams } from '../../application/ports/messaging-api.port.js';
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';

@Injectable()
export class KapsoWhatsAppService {
  private readonly logger = new Logger(KapsoWhatsAppService.name);
  private readonly baseUrl = 'https://api.kapso.ai/meta/whatsapp';

  async sendTypingIndicator(params: TypingIndicatorParams): Promise<void> {
    const apiKey = params.providerConfig.apiKey;
    if (!apiKey) return;

    const url = `${this.baseUrl}/v24.0/${params.phoneNumberId}/messages`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.to,
          type: 'typing_indicator',
          typing_indicator: { type: 'text' },
        }),
      });
    } catch (error: any) {
      this.logger.warn(`Typing indicator failed: ${error.message}`);
    }
  }

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
    } else if (params.type === 'template' && params.template) {
      body.template = {
        name: params.template.name,
        language: { code: params.template.language },
        ...(params.template.components?.length ? { components: params.template.components } : {}),
      };
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
      const errorText = await response.text();
      this.logger.error(`Kapso API error: ${response.status} ${errorText}`);
      // Kapso proxies Meta responses verbatim, so Meta error codes apply
      let errorBody: MetaErrorBody | null = null;
      try {
        errorBody = JSON.parse(errorText) as MetaErrorBody;
      } catch {
        // non-JSON error body — classify by HTTP status alone
      }
      throw classifyMetaError(response.status, errorBody);
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> };

    return { waMessageId: data.messages[0].id };
  }
}
