export interface ImageDimensions {
  width: number | null;
  height: number | null;
}

export interface GeneratedThumbnail {
  kind: 'thumb-256' | 'thumb-1024';
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

export interface ImageProcessorPort {
  dimensions(buffer: Buffer): Promise<ImageDimensions>;
  thumbnails(buffer: Buffer): Promise<GeneratedThumbnail[]>;
  /**
   * Ajusta la imagen a lo que WhatsApp acepta (JPEG/PNG, hasta 5 MB).
   * `null` si ya cumple y no hay nada que tocar.
   */
  normalizeForWhatsApp(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null>;
}
