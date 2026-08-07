import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

export interface MediaDownloadParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  /** Id de media que devolvió el webhook. */
  providerMediaId: string;
  /** phone_number_id: Meta lo acepta como parámetro opcional al resolver el id. */
  phoneNumberId?: string;
}

export interface MediaDownloadResult {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  /** Hex. Lo que reporta el proveedor, para verificar integridad. */
  sha256: string | null;
}

export interface MediaUploadParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  /** El phone_number_id del proveedor, no nuestro id interno. */
  phoneNumberId: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface MediaUploadResult {
  providerMediaId: string;
}

/**
 * Bajar y subir archivos contra el proveedor de mensajería.
 *
 * Está separado de `MessagingApiPort` a propósito: enviar un mensaje y mover
 * bytes tienen ciclos de vida, límites y modos de falla distintos.
 */
export interface MediaProviderPort {
  download(params: MediaDownloadParams): Promise<MediaDownloadResult>;
  upload(params: MediaUploadParams): Promise<MediaUploadResult>;
}

/** El original ya no existe en el proveedor (los 30 días de Meta). */
export class MediaGoneAtSourceError extends Error {
  constructor(mediaId: string) {
    super(`El archivo ${mediaId} ya no está disponible en el proveedor.`);
    this.name = 'MediaGoneAtSourceError';
  }
}
