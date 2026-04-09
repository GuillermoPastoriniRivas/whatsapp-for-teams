import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageParams, SendMessageResult } from '../../application/ports/messaging-api.port.js';

@Injectable()
export class MetaCloudApiService {
  private readonly logger = new Logger(MetaCloudApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
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
      const error = await response.text();
      this.logger.error(`Meta API error: ${response.status} ${error}`);
      throw new Error(`Meta Cloud API error: ${response.status}`);
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> };

    return { waMessageId: data.messages[0].id };
  }
}
