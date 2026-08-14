export type KnowledgeSource = 'text' | 'url' | 'file';

export type KnowledgeStatus = 'ready' | 'failed';

export class KnowledgeDocument {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly title: string,
    public readonly source: KnowledgeSource,
    public readonly sourceRef: string | null,
    public readonly status: KnowledgeStatus,
    public readonly chunkCount: number,
    public readonly characterCount: number,
    public readonly failureReason: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

export interface KnowledgeChunk {
  id: string;
  tenantId: string;
  documentId: string;
  documentTitle: string;
  ordinal: number;
  text: string;
  embedding: number[];
}

export interface KnowledgeExcerpt {
  text: string;
  documentTitle: string;
  documentId: string;
  score: number;
}
