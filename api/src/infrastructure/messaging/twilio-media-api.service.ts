import { Injectable, Logger } from '@nestjs/common';
import {
  MediaDownloadParams,
  MediaDownloadResult,
  MediaGoneAtSourceError,
  MediaUploadResult,
} from '../../application/ports/media-provider.port.js';

/**
 * En Twilio el "media id" es la URL completa del recurso, y se baja con Basic
 * auth de la cuenta. No hay endpoint de upload: a Twilio se le manda media por
 * URL pública, así que el envío usa el camino de `link`.
 */
@Injectable()
export class TwilioMediaApiService {
  private readonly logger = new Logger(TwilioMediaApiService.name);

  async download(params: MediaDownloadParams): Promise<MediaDownloadResult> {
    const { accountSid, authToken } = params.providerConfig;
    if (!accountSid || !authToken) {
      throw new Error('Twilio: faltan accountSid/authToken en providerConfig');
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(params.providerMediaId, {
      headers: { Authorization: `Basic ${credentials}` },
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        throw new MediaGoneAtSourceError(params.providerMediaId);
      }
      const text = await response.text();
      this.logger.error(`Descarga de media (Twilio) falló: ${response.status} ${text.slice(0, 200)}`);
      throw new Error(`Twilio media download failed with status ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      buffer,
      mimeType: response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream',
      sizeBytes: buffer.byteLength,
      sha256: null,
    };
  }

  async upload(): Promise<MediaUploadResult> {
    throw new Error('Twilio no expone un endpoint de upload de media; se envía por URL pública.');
  }
}
