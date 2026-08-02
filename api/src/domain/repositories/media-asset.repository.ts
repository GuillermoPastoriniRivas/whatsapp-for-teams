import { MediaAsset, MediaDerivative } from '../entities/media-asset.entity.js';
import { MediaAssetStatus } from '../enums/media-asset-status.enum.js';
import { MediaKind } from '../enums/media-kind.enum.js';
import { MediaSource } from '../enums/media-source.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export interface CreateMediaAssetInput {
  tenantId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  sha256?: string | null;
  filename?: string | null;
  storageKey?: string | null;
  storageProvider?: string | null;
  metaMediaId?: string | null;
  metaExpiresAt?: Date | null;
  source: MediaSource;
  phoneNumberId?: string | null;
  conversationId?: string | null;
  contactId?: string | null;
  messageId?: string | null;
  uploadedByAgentId?: string | null;
  status: MediaAssetStatus;
  expiresAt?: Date | null;
  inLibrary?: boolean;
  title?: string | null;
  tags?: string[];
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export interface UpdateMediaAssetInput {
  status?: MediaAssetStatus;
  failureReason?: string | null;
  sha256?: string | null;
  sizeBytes?: number;
  mimeType?: string;
  storageKey?: string | null;
  storageProvider?: string | null;
  derivatives?: MediaDerivative[];
  metaMediaId?: string | null;
  metaExpiresAt?: Date | null;
  backfilledAt?: Date | null;
  messageId?: string | null;
  expiresAt?: Date | null;
  inLibrary?: boolean;
  title?: string | null;
  tags?: string[];
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  deletedAt?: Date | null;
}

export interface MediaAssetQuery {
  tenantId: string;
  /** `true` = biblioteca curada, `false` = historial, `undefined` = todo. */
  inLibrary?: boolean;
  kinds?: MediaKind[];
  sources?: MediaSource[];
  /** Restringe a los números a los que el agente tiene acceso. */
  phoneNumberIds?: string[];
  conversationId?: string;
  contactId?: string;
  tags?: string[];
  /** Busca en filename, title y tags. */
  search?: string;
  from?: Date;
  to?: Date;
  includeDeleted?: boolean;
  page: number;
  limit: number;
}

export interface MediaUsageBreakdown {
  kind: MediaKind;
  count: number;
  bytes: number;
}

export interface MediaUsageSummary {
  storedBytes: number;
  storedCount: number;
  byKind: MediaUsageBreakdown[];
  /** Passthrough: archivos que solo viven en Meta y todavía no expiraron. */
  metaOnlyCount: number;
  metaOnlyBytes: number;
  /** Passthrough: archivos que ya se perdieron por el límite de 30 días. */
  expiredCount: number;
  expiredBytes: number;
}

export interface MediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  findById(id: string): Promise<MediaAsset | null>;
  findByIds(ids: string[]): Promise<MediaAsset[]>;
  findByMessageId(messageId: string): Promise<MediaAsset | null>;
  /** Dedup por contenido dentro del tenant. Solo assets con bytes propios. */
  findStoredBySha256(tenantId: string, sha256: string): Promise<MediaAsset | null>;
  /**
   * Asset del tenant con ese contenido cuyos bytes todavía se pueden leer: o
   * están guardados, o el original sigue vivo en Meta. Evita volver a subir el
   * mismo archivo cuando el agente lo manda por segunda vez.
   */
  findReusableBySha256(tenantId: string, sha256: string, now: Date): Promise<MediaAsset | null>;
  update(id: string, input: UpdateMediaAssetInput): Promise<MediaAsset | null>;
  search(query: MediaAssetQuery): Promise<PaginatedResult<MediaAsset>>;
  usageSummary(tenantId: string, now: Date): Promise<MediaUsageSummary>;
  /** Assets del tenant que siguen vivos en Meta y todavía no bajamos. */
  findBackfillCandidates(tenantId: string, now: Date, limit: number): Promise<MediaAsset[]>;
  countBackfillCandidates(tenantId: string, now: Date): Promise<number>;
  /** Marca como perdidos los que se vencieron en Meta sin haberse guardado. */
  markExpiredAtSource(now: Date): Promise<number>;
  /** Assets almacenados cuya retención venció; devuelve el lote a purgar. */
  findExpiredStored(now: Date, limit: number): Promise<MediaAsset[]>;
  hardDelete(id: string): Promise<void>;
  countByTenant(tenantId: string): Promise<number>;
  listTags(tenantId: string): Promise<string[]>;
}
