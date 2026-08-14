import { KnowledgeDocument, KnowledgeChunk } from '../entities/knowledge-document.entity.js';

export interface KnowledgeRepository {
  createDocument(
    document: Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeDocument>;
  findDocumentById(id: string): Promise<KnowledgeDocument | null>;
  findDocumentsByTenantId(tenantId: string): Promise<KnowledgeDocument[]>;
  deleteDocument(id: string): Promise<void>;

  replaceChunks(documentId: string, chunks: Omit<KnowledgeChunk, 'id'>[]): Promise<void>;
  findChunksByTenantId(tenantId: string, limit: number): Promise<KnowledgeChunk[]>;
  countChunksByTenantId(tenantId: string): Promise<number>;
}
