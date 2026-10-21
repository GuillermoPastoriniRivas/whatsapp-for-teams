import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { KnowledgeSource, KnowledgeStatus } from '../../../../domain/entities/knowledge-document.entity.js';

export type KnowledgeDocumentDocument = HydratedDocument<KnowledgeDocumentModel>;

@Schema({ collection: 'knowledge_documents', timestamps: true })
export class KnowledgeDocumentModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  // `type: String` explícito: con ts-jest + isolatedModules el `design:type`
  // de un alias de unión se pierde y @nestjs/mongoose no puede inferirlo.
  @Prop({ type: String, required: true })
  source: KnowledgeSource;

  @Prop({ type: String, default: null })
  sourceRef: string | null;

  @Prop({ type: String, required: true, default: 'ready' })
  status: KnowledgeStatus;

  @Prop({ default: 0 })
  chunkCount: number;

  @Prop({ default: 0 })
  characterCount: number;

  @Prop({ type: String, default: null })
  failureReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const KnowledgeDocumentSchema = SchemaFactory.createForClass(KnowledgeDocumentModel);
KnowledgeDocumentSchema.index({ tenantId: 1, createdAt: -1 });

export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunkModel>;

@Schema({ collection: 'knowledge_chunks', timestamps: { createdAt: true, updatedAt: false } })
export class KnowledgeChunkModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  documentId: Types.ObjectId;

  @Prop({ required: true })
  documentTitle: string;

  @Prop({ required: true })
  ordinal: number;

  @Prop({ required: true })
  text: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  createdAt: Date;
}

export const KnowledgeChunkSchema = SchemaFactory.createForClass(KnowledgeChunkModel);
KnowledgeChunkSchema.index({ tenantId: 1 });
KnowledgeChunkSchema.index({ documentId: 1 });
