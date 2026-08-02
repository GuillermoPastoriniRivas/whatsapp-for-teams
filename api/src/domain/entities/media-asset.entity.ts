import { MediaAssetStatus } from '../enums/media-asset-status.enum.js';
import { MediaKind } from '../enums/media-kind.enum.js';
import { MediaSource } from '../enums/media-source.enum.js';

/** Variante derivada de un asset (thumbnail, poster). Solo en planes pagos. */
export interface MediaDerivative {
  kind: 'thumb-256' | 'thumb-1024';
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

/**
 * Un archivo que pasó por WhatsApp. La fila existe en TODOS los planes: en free
 * solo guardamos la metadata y el archivo vive (30 días) en Meta; en planes
 * pagos además guardamos los bytes en nuestro storage.
 */
export class MediaAsset {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    // ── contenido ──────────────────────────────────────────
    public readonly kind: MediaKind,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
    /** Hex. Viene del webhook de Meta (en base64) o se calcula al subir. */
    public readonly sha256: string | null,
    public readonly filename: string | null,
    // ── storage propio (null en plan free) ─────────────────
    public readonly storageKey: string | null,
    public readonly storageProvider: string | null,
    public readonly derivatives: MediaDerivative[],
    // ── origen en Meta (siempre) ───────────────────────────
    public readonly metaMediaId: string | null,
    public readonly metaExpiresAt: Date | null,
    public readonly backfilledAt: Date | null,
    // ── procedencia ────────────────────────────────────────
    public readonly source: MediaSource,
    public readonly phoneNumberId: string | null,
    public readonly conversationId: string | null,
    public readonly contactId: string | null,
    public readonly messageId: string | null,
    public readonly uploadedByAgentId: string | null,
    // ── ciclo de vida ──────────────────────────────────────
    public readonly status: MediaAssetStatus,
    public readonly failureReason: string | null,
    public readonly expiresAt: Date | null,
    public readonly deletedAt: Date | null,
    // ── biblioteca ─────────────────────────────────────────
    public readonly inLibrary: boolean,
    public readonly title: string | null,
    public readonly tags: string[],
    // ── render ─────────────────────────────────────────────
    public readonly width: number | null,
    public readonly height: number | null,
    public readonly durationMs: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** ¿Tenemos los bytes en nuestro storage? */
  get isStored(): boolean {
    return this.status === MediaAssetStatus.READY && !!this.storageKey;
  }

  /** ¿El original de Meta sigue vivo? */
  isAvailableAtSource(now: Date = new Date()): boolean {
    if (!this.metaMediaId) return false;
    if (!this.metaExpiresAt) return true;
    return this.metaExpiresAt.getTime() > now.getTime();
  }

  /** Ni bytes propios ni original vivo: el archivo se perdió. */
  isUnavailable(now: Date = new Date()): boolean {
    return !this.isStored && !this.isAvailableAtSource(now);
  }
}
