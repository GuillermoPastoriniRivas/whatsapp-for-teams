import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadReceiptParams, SendMessageParams, SendMessageResult } from '../../application/ports/messaging-api.port.js';
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';
import { buildInteractivePayload } from './interactive-payload.builder.js';
import { buildMediaPayload } from './media-payload.builder.js';
import { addressee } from './addressee.builder.js';

@Injectable()
export class MetaCloudApiService {
  private readonly logger = new Logger(MetaCloudApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  /**
   * Marca un entrante como leído (tilde azul) y, si se pide, muestra
   * "escribiendo…". Es best-effort: no rompe el flujo del que lo llama, pero
   * **sí** loguea el fallo — `fetch` no tira en 4xx, así que sin esto los
   * errores de la API pasaban en silencio.
   */
  async markAsRead(params: ReadReceiptParams): Promise<void> {
    const accessToken = params.providerConfig.accessToken;
    if (!accessToken || !params.waMessageId) return;

    const url = `https://graph.facebook.com/${this.apiVersion}/${params.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: params.waMessageId,
          ...(params.typing ? { typing_indicator: { type: 'text' } } : {}),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Mark-as-read falló para ${params.waMessageId}: ${response.status} ${text.slice(0, 200)}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Mark-as-read falló para ${params.waMessageId}: ${error.message}`);
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const accessToken = params.providerConfig.accessToken;
    if (!accessToken) {
      throw new Error('Meta Cloud API: missing accessToken in providerConfig');
    }

    // MM Lite es otro endpoint, con el mismo cuerpo. Sólo tiene sentido para
    // plantillas: el resto de los tipos no existen en ese canal.
    const edge = params.marketingLite && params.type === 'template' ? 'marketing_messages' : 'messages';
    const url = `https://graph.facebook.com/${this.apiVersion}/${params.phoneNumberId}/${edge}`;

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      ...addressee(params),
      type: params.type,
    };

    const mediaPayload = buildMediaPayload(params);

    if (params.type === 'text' && params.body) {
      body.text = { body: params.body };
    } else if (mediaPayload) {
      body[params.type] = mediaPayload;
    } else if (params.type === 'template' && params.template) {
      body.template = {
        name: params.template.name,
        language: { code: params.template.language },
        ...(params.template.components?.length ? { components: params.template.components } : {}),
      };
    } else if (params.type === 'interactive' && params.interactive) {
      body.interactive = buildInteractivePayload(params.interactive);
    } else if (params.type === 'location' && params.location) {
      body.location = {
        latitude: params.location.latitude,
        longitude: params.location.longitude,
        ...(params.location.name ? { name: params.location.name } : {}),
        ...(params.location.address ? { address: params.location.address } : {}),
      };
    } else if (params.type === 'contacts' && params.contacts?.length) {
      body.contacts = params.contacts;
    } else if (params.type === 'reaction' && params.reaction) {
      body.reaction = {
        message_id: params.reaction.waMessageId,
        emoji: params.reaction.emoji,
      };
    }

    // Citar un mensaje anterior. La reacción se excluye: apunta a su objetivo
    // por `reaction.message_id` y Meta rechaza el `context` redundante.
    if (params.contextWaMessageId && params.type !== 'reaction') {
      body.context = { message_id: params.contextWaMessageId };
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
