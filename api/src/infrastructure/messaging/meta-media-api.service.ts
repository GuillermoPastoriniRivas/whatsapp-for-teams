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

/**
 * Distingue "el archivo ya no existe" de "algo salió mal".
 *
 * Importa mucho más de lo que parece: `MediaGoneAtSourceError` es terminal
 * —marca el asset como perdido, no se reintenta— y la UI le dice al cliente que
 * WhatsApp lo borró. Clasificar de más un error de config o de auth como
 * "expirado" hace que demos por perdido un archivo que sigue estando, y encima
 * le echemos la culpa a WhatsApp.
 *
 * Por eso solo cuenta la señal explícita de Meta: code 100 + subcode 33
 * ("Object does not exist"). Un 400 o un 404 pelados NO alcanzan — Kapso
 * responde 404 cuando no puede resolver la config del número, y eso se arregla
 * reintentando bien, no dando el archivo por muerto.
 */
export function classifyMediaDownloadError(mediaId: string, status: number, text: string): Error {
  let body: MetaErrorBody | null = null;
  try {
    body = JSON.parse(text) as MetaErrorBody;
  } catch {
    // cuerpo no-JSON (proxy/HTML): se clasifica solo por el status
  }

  if (body?.error?.code === 100 && body.error.error_subcode === 33) {
    return new MediaGoneAtSourceError(mediaId);
  }
  if (status === 410) return new MediaGoneAtSourceError(mediaId);

  return classifyMetaError(status, body);
}

interface MetaMediaMetadata {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
  /**
   * Extensión de Kapso, no existe en Meta. La `url` de Meta apunta a
   * lookaside.fbsbx.com y exige el Bearer del negocio —que con Kapso no
   * tenemos—, así que ellos exponen su propio proxy acá.
   */
  download_url?: string;
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
    const metadata = await this.resolveMetadata(
      params.providerMediaId,
      headers,
      params.phoneNumberId,
    );

    // `download_url` (Kapso) primero: su `url` es la de Meta y responde 401 sin
    // el Bearer del negocio. En Meta el campo no existe y se usa `url`.
    const binaryUrl = metadata.download_url ?? metadata.url;

    const response = await fetch(binaryUrl, {
      headers: { ...headers, 'User-Agent': MEDIA_USER_AGENT },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Descarga de media ${params.providerMediaId} falló: ${response.status} ${text.slice(0, 300)}`,
      );
      throw this.classifyDownloadError(params.providerMediaId, response.status, text);
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
    phoneNumberId?: string,
  ): Promise<MetaMediaMetadata> {
    const query = phoneNumberId ? `?phone_number_id=${encodeURIComponent(phoneNumberId)}` : '';

    const response = await fetch(`${this.baseUrl()}/${mediaId}${query}`, {
      headers: { ...headers, 'User-Agent': MEDIA_USER_AGENT },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Resolución de media ${mediaId} falló: ${response.status} ${text.slice(0, 300)}`,
      );
      throw this.classifyDownloadError(mediaId, response.status, text);
    }

    return (await response.json()) as MetaMediaMetadata;
  }

  protected classifyDownloadError(mediaId: string, status: number, text: string): Error {
    return classifyMediaDownloadError(mediaId, status, text);
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
 * Kapso reenvía la API de Meta con su propia base y auth por API key.
 *
 * Dos diferencias en media, ambas descubiertas probando contra su API:
 *
 * 1. La metadata **exige** `?phone_number_id=`. Sin eso responde
 *    `404 {"error":"WhatsApp configuration not found"}` — que no significa que
 *    el archivo no exista, sino que no sabe de qué número le hablás.
 * 2. Devuelve un campo extra `download_url` que apunta a su propio proxy. La
 *    `url` de Meta (lookaside.fbsbx.com) responde 401 porque espera el Bearer
 *    del negocio, que con Kapso no tenemos.
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
