import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import {
  MediaDownloadParams,
  MediaDownloadResult,
  MediaProviderPort,
  MediaUploadParams,
  MediaUploadResult,
} from '../../application/ports/media-provider.port.js';
import { KapsoMediaApiService, MetaMediaApiService } from './meta-media-api.service.js';
import { TwilioMediaApiService } from './twilio-media-api.service.js';

/** 1x1 PNG transparente — el tenant demo nunca toca una API real. */
const DEMO_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

@Injectable()
export class MediaProviderStrategyService implements MediaProviderPort {
  constructor(
    private readonly meta: MetaMediaApiService,
    private readonly kapso: KapsoMediaApiService,
    private readonly twilio: TwilioMediaApiService,
  ) {}

  async download(params: MediaDownloadParams): Promise<MediaDownloadResult> {
    switch (params.provider) {
      case MessagingProvider.META:
        return this.meta.download(params);
      case MessagingProvider.KAPSO:
        return this.kapso.download(params);
      case MessagingProvider.TWILIO:
        return this.twilio.download(params);
      case MessagingProvider.DEMO:
        return {
          buffer: DEMO_PIXEL,
          mimeType: 'image/png',
          sizeBytes: DEMO_PIXEL.byteLength,
          sha256: null,
        };
      default:
        throw new Error(`Descarga de media no soportada para el proveedor ${params.provider}`);
    }
  }

  async upload(params: MediaUploadParams): Promise<MediaUploadResult> {
    switch (params.provider) {
      case MessagingProvider.META:
        return this.meta.upload(params);
      case MessagingProvider.KAPSO:
        return this.kapso.upload(params);
      case MessagingProvider.DEMO:
        return { providerMediaId: `demo-media-${randomUUID()}` };
      default:
        throw new Error(`Upload de media no soportado para el proveedor ${params.provider}`);
    }
  }
}
