import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { MediaKind } from '../../domain/enums/media-kind.enum.js';
import { WHATSAPP_SIZE_LIMITS } from '../../domain/constants/media-constraints.js';
import type {
  GeneratedThumbnail,
  ImageDimensions,
  ImageProcessorPort,
} from '../../application/ports/image-processor.port.js';

const THUMB_SPECS: Array<{ kind: 'thumb-256' | 'thumb-1024'; size: number; quality: number }> = [
  { kind: 'thumb-256', size: 256, quality: 72 },
  { kind: 'thumb-1024', size: 1024, quality: 80 },
];

/**
 * Procesamiento de imágenes con sharp. Sin ffmpeg a propósito: video y audio se
 * validan y se rechazan con un mensaje claro en vez de meter un binario pesado
 * en el contenedor por un caso borde.
 */
@Injectable()
export class ImageProcessorService implements ImageProcessorPort {
  private readonly logger = new Logger(ImageProcessorService.name);

  async dimensions(buffer: Buffer): Promise<ImageDimensions> {
    try {
      const metadata = await sharp(buffer).metadata();
      return { width: metadata.width ?? null, height: metadata.height ?? null };
    } catch {
      return { width: null, height: null };
    }
  }

  /**
   * Miniaturas para la grilla de la biblioteca. Servir 20 KB en vez del
   * original de 3 MB es lo que mantiene el egress bajo control.
   */
  async thumbnails(buffer: Buffer): Promise<GeneratedThumbnail[]> {
    const results: GeneratedThumbnail[] = [];

    for (const spec of THUMB_SPECS) {
      try {
        const output = await sharp(buffer)
          .rotate() // respeta la orientación EXIF antes de recortar
          .resize(spec.size, spec.size, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: spec.quality })
          .toBuffer({ resolveWithObject: true });

        results.push({
          kind: spec.kind,
          buffer: output.data,
          mimeType: 'image/webp',
          width: output.info.width,
          height: output.info.height,
        });
      } catch (error: any) {
        this.logger.warn(`No se pudo generar ${spec.kind}: ${error?.message}`);
      }
    }

    return results;
  }

  /**
   * Ajusta una imagen a lo que WhatsApp acepta: JPEG o PNG, hasta 5 MB.
   * Devuelve `null` si ya cumple y no hay nada que tocar.
   */
  async normalizeForWhatsApp(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const limit = WHATSAPP_SIZE_LIMITS[MediaKind.IMAGE];
    const isAccepted = mimeType === 'image/jpeg' || mimeType === 'image/png';

    if (isAccepted && buffer.byteLength <= limit) return null;

    let pipeline = sharp(buffer).rotate();
    const metadata = await pipeline.metadata();

    // 2560px de lado mayor mantiene calidad razonable y baja mucho el peso.
    if ((metadata.width ?? 0) > 2560 || (metadata.height ?? 0) > 2560) {
      pipeline = pipeline.resize(2560, 2560, { fit: 'inside', withoutEnlargement: true });
    }

    for (const quality of [85, 72, 60, 45]) {
      const output = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (output.byteLength <= limit) {
        return { buffer: output, mimeType: 'image/jpeg' };
      }
    }

    // Último intento: bajar también la resolución.
    const output = await sharp(buffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60, mozjpeg: true })
      .toBuffer();

    if (output.byteLength > limit) {
      throw new Error('La imagen sigue superando los 5 MB que acepta WhatsApp después de comprimirla.');
    }

    return { buffer: output, mimeType: 'image/jpeg' };
  }
}
