import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaDownloadParams,
  MediaDownloadResult,
  MediaGoneAtSourceError,
  MediaUploadParams,
  MediaUploadResult,
} from '../../application/ports/media-provider.port.js';
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';

/**
 * Meta exige un User-Agent en la descarga del binario: sin él devuelve 400 con
 * un cuerpo vacío. No está documentado de forma prominente y cuesta horas.
 */
const MEDIA_USER_AGENT = 'asis.chat/1.0 (+https://asis.chat)';

interface MetaMediaMetadata {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
}

@Injectable()
export class MetaMediaApiService {
  private readonly logger = new Logger(MetaMediaApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  protected baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  protected authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    const accessToken = providerConfig.accessToken;
    if (!accessToken) throw new Error('Meta Cloud API: falta accessToken en providerConfig');
    return { Authorization: `Bearer ${accessToken}` };
  }

  /**
   * Descarga en dos pasos: primero se resuelve el id a una URL firmada (vive
   * ~5 minutos), después se bajan los bytes. En un reintento hay que rehacer el
   * paso 1: la URL anterior ya caducó.
   */
  async download(params: MediaDownloadParams): Promise<MediaDownloadResult> {
    const headers = this.authHeaders(params.providerConfig);
    const metadata = await this.resolveMetadata(params.providerMediaId, headers);

    const response = await fetch(metadata.url, {
      headers: { ...headers, 'User-Agent': MEDIA_USER_AGENT },
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        throw new MediaGoneAtSourceError(params.providerMediaId);
      }
      const text = await response.text();
      this.logger.error(`Descarga de media falló: ${response.status} ${text.slice(0, 300)}`);
      throw this.toMetaError(response.status, text);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      buffer,
      mimeType: metadata.mime_type ?? 'application/octet-stream',
      sizeBytes: buffer.byteLength,
      sha256: metadata.sha256 ? Buffer.from(metadata.sha256, 'base64').toString('hex') : null,
    };
  }

  private async resolveMetadata(
    mediaId: string,
    headers: Record<string, string>,
  ): Promise<MetaMediaMetadata> {
    const response = await fetch(`${this.baseUrl()}/${mediaId}`, {
      headers: { ...headers, 'User-Agent': MEDIA_USER_AGENT },
    });

    if (!response.ok) {
      const text = await response.text();
      // Pasados los 30 días el id deja de existir; para el que llama no es un
      // error transitorio, es un archivo que se perdió.
      if (response.status === 404 || response.status === 400) {
        throw new MediaGoneAtSourceError(mediaId);
      }
      this.logger.error(`Resolución de media falló: ${response.status} ${text.slice(0, 300)}`);
      throw this.toMetaError(response.status, text);
    }

    return (await response.json()) as MetaMediaMetadata;
  }

  /**
   * Sube los bytes y devuelve un `media_id`. El id queda atado al número que
   * hizo el upload y vive 30 días.
   */
  async upload(params: MediaUploadParams): Promise<MediaUploadResult> {
    const headers = this.authHeaders(params.providerConfig);

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', params.mimeType);
    form.append(
      'file',
      new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }),
      params.filename,
    );

    const response = await fetch(`${this.baseUrl()}/${params.phoneNumberId}/media`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Upload de media falló: ${response.status} ${text.slice(0, 300)}`);
      throw this.toMetaError(response.status, text);
    }

    const data = (await response.json()) as { id: string };
    return { providerMediaId: data.id };
  }

  protected toMetaError(status: number, text: string): Error {
    let body: MetaErrorBody | null = null;
    try {
      body = JSON.parse(text) as MetaErrorBody;
    } catch {
      // cuerpo no-JSON (proxy/HTML): se clasifica solo por el status
    }
    return classifyMetaError(status, body);
  }
}

/**
 * Kapso reenvía la API de Meta con su propia base y auth por API key. Los
 * endpoints de media siguen el mismo contrato.
 *
 * Salvedad: el paso 2 de la descarga usa la URL que devuelve el paso 1. Si
 * Kapso devuelve la URL cruda de `lookaside.fbsbx.com` (que espera el Bearer de
 * Meta) en vez de una propia, la bajada falla — no tenemos ese token. El error
 * queda logueado con el status para poder distinguirlo de un 30-días-vencido.
 */
@Injectable()
export class KapsoMediaApiService extends MetaMediaApiService {
  protected override baseUrl(): string {
    return 'https://api.kapso.ai/meta/whatsapp/v24.0';
  }

  protected override authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    const apiKey = providerConfig.apiKey;
    if (!apiKey) throw new Error('Kapso: falta apiKey en providerConfig');
    return { 'X-API-Key': apiKey };
  }
}
