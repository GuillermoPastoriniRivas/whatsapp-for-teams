import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { KnowledgeRepository } from '../../../../domain/repositories/knowledge.repository.js';
import {
  KnowledgeDocument,
  type KnowledgeChunk,
} from '../../../../domain/entities/knowledge-document.entity.js';
import {
  KnowledgeChunkModel,
  KnowledgeDocumentModel,
  type KnowledgeChunkDocument,
  type KnowledgeDocumentDocument,
} from '../schemas/knowledge.schema.js';

@Injectable()
export class MongoKnowledgeRepository implements KnowledgeRepository {
  constructor(
    @InjectModel(KnowledgeDocumentModel.name) private readonly documents: Model<KnowledgeDocumentDocument>,
    @InjectModel(KnowledgeChunkModel.name) private readonly chunks: Model<KnowledgeChunkDocument>,
  ) {}

  private toDocument(doc: KnowledgeDocumentDocument): KnowledgeDocument {
    return new KnowledgeDocument(
      doc._id.toString(),
      doc.tenantId.toString(),
      doc.title,
      doc.source,
      doc.sourceRef ?? null,
      doc.status,
      doc.chunkCount,
      doc.characterCount,
      doc.failureReason ?? null,
      doc.createdAt,
      doc.updatedAt,
    );
  }

  async createDocument(
    document: Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeDocument> {
    const created = await this.documents.create({
      tenantId: new Types.ObjectId(document.tenantId),
      title: document.title,
      source: document.source,
      sourceRef: document.sourceRef,
      status: document.status,
      chunkCount: document.chunkCount,
      characterCount: document.characterCount,
      failureReason: document.failureReason,
    });
    return this.toDocument(created);
  }

  async findDocumentById(id: string): Promise<KnowledgeDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const found = await this.documents.findById(id);
    return found ? this.toDocument(found) : null;
  }

  async findDocumentsByTenantId(tenantId: string): Promise<KnowledgeDocument[]> {
    const found = await this.documents
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 });
    return found.map((doc) => this.toDocument(doc));
  }

  async deleteDocument(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await this.chunks.deleteMany({ documentId: new Types.ObjectId(id) });
    await this.documents.deleteOne({ _id: new Types.ObjectId(id) });
  }

  async replaceChunks(documentId: string, chunks: Omit<KnowledgeChunk, 'id'>[]): Promise<void> {
    await this.chunks.deleteMany({ documentId: new Types.ObjectId(documentId) });
    if (chunks.length === 0) return;
    await this.chunks.insertMany(
      chunks.map((chunk) => ({
        tenantId: new Types.ObjectId(chunk.tenantId),
        documentId: new Types.ObjectId(chunk.documentId),
        documentTitle: chunk.documentTitle,
        ordinal: chunk.ordinal,
        text: chunk.text,
        embedding: chunk.embedding,
      })),
    );
  }

  async findChunksByTenantId(tenantId: string, limit: number): Promise<KnowledgeChunk[]> {
    const found = await this.chunks.find({ tenantId: new Types.ObjectId(tenantId) }).limit(limit);
    return found.map((chunk) => ({
      id: chunk._id.toString(),
      tenantId: chunk.tenantId.toString(),
      documentId: chunk.documentId.toString(),
      documentTitle: chunk.documentTitle,
      ordinal: chunk.ordinal,
      text: chunk.text,
      embedding: chunk.embedding,
    }));
  }

  async countChunksByTenantId(tenantId: string): Promise<number> {
    return this.chunks.countDocuments({ tenantId: new Types.ObjectId(tenantId) });
  }
}
