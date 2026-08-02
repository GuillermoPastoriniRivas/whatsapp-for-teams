import { DomainError } from './domain-errors.js';

export class UnsupportedMediaTypeError extends DomainError {
  constructor(mimeType: string) {
    super(
      'UNSUPPORTED_MEDIA_TYPE',
      `WhatsApp no acepta archivos ${mimeType}. Convertilo a un formato soportado (JPG, PNG, PDF, MP4, MP3) e intentá de nuevo.`,
    );
  }
}

export class MediaTooLargeError extends DomainError {
  constructor(sizeBytes: number, limitBytes: number, kind: string) {
    const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1).replace('.0', '');
    super(
      'MEDIA_TOO_LARGE',
      `El archivo pesa ${mb(sizeBytes)} MB y WhatsApp acepta hasta ${mb(limitBytes)} MB para ${kind}.`,
    );
  }
}

export class MediaNotFoundError extends DomainError {
  constructor() {
    super('MEDIA_NOT_FOUND', 'El archivo no existe o no pertenece a esta cuenta.');
  }
}

export class MediaUnavailableError extends DomainError {
  constructor() {
    super(
      'MEDIA_UNAVAILABLE',
      'Este archivo ya no está disponible. WhatsApp lo guarda solo 30 días.',
    );
  }
}

export class StorageQuotaExceededError extends DomainError {
  constructor(usedBytes: number, quotaBytes: number) {
    const gb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);
    super(
      'STORAGE_QUOTA_EXCEEDED',
      `Llegaste al límite de almacenamiento de tu plan (${gb(usedBytes)} de ${gb(quotaBytes)} GB). Liberá espacio o pasate a un plan superior.`,
    );
  }
}

export class MediaLibraryUnavailableError extends DomainError {
  constructor() {
    super(
      'MEDIA_LIBRARY_UNAVAILABLE',
      'La biblioteca de archivos está disponible en los planes pagos. En el plan gratuito los archivos viven 30 días en WhatsApp y después se pierden.',
    );
  }
}

/**
 * El plan sí incluye biblioteca, pero la instalación no tiene storage. Es un
 * problema de configuración: ofrecerle un upgrade al cliente no lo arregla.
 */
export class MediaStorageNotConfiguredError extends DomainError {
  constructor() {
    super(
      'MEDIA_STORAGE_NOT_CONFIGURED',
      'El almacenamiento de archivos no está configurado en este entorno. Falta definir MEDIA_S3_BUCKET (producción) o MEDIA_LOCAL_PATH (desarrollo).',
    );
  }
}

export class CampaignMediaUnavailableError extends DomainError {
  constructor() {
    super(
      'CAMPAIGN_MEDIA_UNAVAILABLE',
      'Adjuntar archivos a campañas requiere un plan pago: necesitamos guardar el archivo para poder reenviarlo cuando WhatsApp lo descarta.',
    );
  }
}
