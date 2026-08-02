import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MediaAssetStatus } from '../../../../domain/enums/media-asset-status.enum.js';
import { MediaKind } from '../../../../domain/enums/media-kind.enum.js';
import { MediaSource } from '../../../../domain/enums/media-source.enum.js';
import type { MediaDerivative } from '../../../../domain/entities/media-asset.entity.js';

export type MediaAssetDocument = HydratedDocument<MediaAssetModel>;

@Schema({ collection: 'media_assets', timestamps: true })
export class MediaAssetModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: MediaKind })
  kind: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({ type: String, default: null })
  sha256: string | null;

  @Prop({ type: String, default: null })
  filename: string | null;

  @Prop({ type: String, default: null })
  storageKey: string | null;

  @Prop({ type: String, default: null })
  storageProvider: string | null;

  @Prop({ type: Array, default: [] })
  derivatives: MediaDerivative[];

  @Prop({ type: String, default: null })
  metaMediaId: string | null;

  @Prop({ type: Date, default: null })
  metaExpiresAt: Date | null;

  @Prop({ type: Date, default: null })
  backfilledAt: Date | null;

  @Prop({ required: true, enum: MediaSource })
  source: string;

  @Prop({ type: Types.ObjectId, default: null })
  phoneNumberId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  conversationId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  contactId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  messageId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  uploadedByAgentId: string | null;

  @Prop({ required: true, enum: MediaAssetStatus })
  status: string;

  @Prop({ type: String, default: null })
  failureReason: string | null;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ default: false })
  inLibrary: boolean;

  @Prop({ type: String, default: null })
  title: string | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Number, default: null })
  width: number | null;

  @Prop({ type: Number, default: null })
  height: number | null;

  @Prop({ type: Number, default: null })
  durationMs: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAssetModel);

// Historial y biblioteca: el filtro base siempre es el tenant + orden temporal.
MediaAssetSchema.index({ tenantId: 1, createdAt: -1 });
MediaAssetSchema.index({ tenantId: 1, inLibrary: 1, createdAt: -1 });
MediaAssetSchema.index({ tenantId: 1, kind: 1, createdAt: -1 });
MediaAssetSchema.index({ conversationId: 1, createdAt: -1 }, { sparse: true });
MediaAssetSchema.index({ contactId: 1, createdAt: -1 }, { sparse: true });
MediaAssetSchema.index({ messageId: 1 }, { sparse: true });
// Dedup por contenido: solo entre los que tienen bytes propios.
MediaAssetSchema.index(
  { tenantId: 1, sha256: 1 },
  { partialFilterExpression: { sha256: { $type: 'string' }, storageKey: { $type: 'string' } } },
);
// Barrido nocturno de los que se vencieron en Meta sin haberse guardado.
MediaAssetSchema.index({ status: 1, metaExpiresAt: 1 }, { sparse: true });
// Purga por retención vencida.
MediaAssetSchema.index({ status: 1, expiresAt: 1 }, { sparse: true });
// Búsqueda por texto en la biblioteca.
MediaAssetSchema.index({ filename: 'text', title: 'text', tags: 'text' });
