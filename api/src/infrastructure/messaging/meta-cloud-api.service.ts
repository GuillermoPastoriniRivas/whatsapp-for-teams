import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageParams, SendMessageResult, TypingIndicatorParams } from '../../application/ports/messaging-api.port.js';
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';

@Injectable()
export class MetaCloudApiService {
  private readonly logger = new Logger(MetaCloudApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  async sendTypingIndicator(params: TypingIndicatorParams): Promise<void> {
    const accessToken = params.providerConfig.accessToken;
    if (!accessToken) return;

    const url = `https://graph.facebook.com/${this.apiVersion}/${params.phoneNumberId}/messages`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
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
    const accessToken = params.providerConfig.accessToken;
    if (!accessToken) {
      throw new Error('Meta Cloud API: missing accessToken in providerConfig');
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${params.phoneNumberId}/messages`;

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
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Meta API error: ${response.status} ${errorText}`);
      let errorBody: MetaErrorBody | null = null;
      try {
        errorBody = JSON.parse(errorText) as MetaErrorBody;
      } catch {
        // non-JSON error body (proxy/HTML) — classify by HTTP status alone
      }
      throw classifyMetaError(response.status, errorBody);
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> };

    return { waMessageId: data.messages[0].id };
  }
}
