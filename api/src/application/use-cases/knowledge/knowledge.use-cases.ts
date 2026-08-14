import { Logger } from '@nestjs/common';
import type { KnowledgeRepository } from '../../../domain/repositories/knowledge.repository.js';
import type {
  KnowledgeDocument,
  KnowledgeExcerpt,
  KnowledgeSource,
} from '../../../domain/entities/knowledge-document.entity.js';
import type { EmbeddingsPort } from '../../ports/embeddings.port.js';
import { cosineSimilarity } from '../../ports/embeddings.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { chunkText } from './chunk-text.js';

export const MAX_CHUNKS_PER_TENANT = 2000;
export const MAX_DOCUMENT_CHARS = 400_000;
export const DEFAULT_EXCERPT_COUNT = 5;
export const MIN_RELEVANCE_SCORE = 0.35;
export const MIN_SHARE_OF_BEST_SCORE = 0.6;

export interface IngestKnowledgeInput {
  tenantId: string;
  title: string;
  text: string;
  source?: KnowledgeSource;
  sourceRef?: string | null;
}

export class IngestKnowledgeUseCase {
  private readonly logger = new Logger(IngestKnowledgeUseCase.name);

  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly embeddings: EmbeddingsPort,
  ) {}

  async execute(input: IngestKnowledgeInput): Promise<Result<KnowledgeDocument, DomainError>> {
    const title = input.title.trim();
    if (!title) return err(new DomainError('KNOWLEDGE_TITLE_REQUIRED', 'El documento necesita un título.'));

    const text = input.text.trim();
    if (!text) return err(new DomainError('KNOWLEDGE_TEXT_REQUIRED', 'El documento no tiene texto.'));
    if (text.length > MAX_DOCUMENT_CHARS) {
      return err(
        new DomainError(
          'KNOWLEDGE_TOO_LARGE',
          `El documento supera los ${MAX_DOCUMENT_CHARS} caracteres. Subilo partido en varios.`,
        ),
      );
    }

    const pieces = chunkText(text);
    if (pieces.length === 0) {
      return err(new DomainError('KNOWLEDGE_TEXT_REQUIRED', 'El documento no tiene texto aprovechable.'));
    }

    const alreadyStored = await this.knowledgeRepo.countChunksByTenantId(input.tenantId);
    if (alreadyStored + pieces.length > MAX_CHUNKS_PER_TENANT) {
      return err(
        new DomainError(
          'KNOWLEDGE_LIMIT_REACHED',
          `La base de conocimiento llegó a su tope de ${MAX_CHUNKS_PER_TENANT} fragmentos. Borrá algún documento antes de subir otro.`,
        ),
      );
    }

    const document = await this.knowledgeRepo.createDocument({
      tenantId: input.tenantId,
      title,
      source: input.source ?? 'text',
      sourceRef: input.sourceRef ?? null,
      status: 'ready',
      chunkCount: pieces.length,
      characterCount: text.length,
      failureReason: null,
    });

    try {
      const vectors = await this.embeddings.embed(pieces);
      await this.knowledgeRepo.replaceChunks(
        document.id,
        pieces.map((piece, ordinal) => ({
          tenantId: input.tenantId,
          documentId: document.id,
          documentTitle: title,
          ordinal,
          text: piece,
          embedding: vectors[ordinal] ?? [],
        })),
      );
    } catch (error: any) {
      this.logger.error(`No se pudo indexar "${title}": ${error?.message}`);
      await this.knowledgeRepo.deleteDocument(document.id);
      return err(
        new DomainError('KNOWLEDGE_INDEXING_FAILED', `No se pudo indexar el documento: ${error?.message ?? 'error desconocido'}`),
      );
    }

    return ok({ ...document, chunkCount: pieces.length } as KnowledgeDocument);
  }
}

export class SearchKnowledgeUseCase {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly embeddings: EmbeddingsPort,
  ) {}

  async execute(tenantId: string, query: string, limit = DEFAULT_EXCERPT_COUNT): Promise<KnowledgeExcerpt[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const chunks = await this.knowledgeRepo.findChunksByTenantId(tenantId, MAX_CHUNKS_PER_TENANT);
    if (chunks.length === 0) return [];

    const [queryVector] = await this.embeddings.embed([trimmed]);
    if (!queryVector) return [];

    const ranked = chunks
      .map((chunk) => ({
        text: chunk.text,
        documentTitle: chunk.documentTitle,
        documentId: chunk.documentId,
        score: cosineSimilarity(queryVector, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < MIN_RELEVANCE_SCORE) return [];

    return ranked
      .filter((excerpt) => excerpt.score >= best.score * MIN_SHARE_OF_BEST_SCORE)
      .slice(0, limit);
  }
}

export class ListKnowledgeUseCase {
  constructor(private readonly knowledgeRepo: KnowledgeRepository) {}

  execute(tenantId: string): Promise<KnowledgeDocument[]> {
    return this.knowledgeRepo.findDocumentsByTenantId(tenantId);
  }
}

export class DeleteKnowledgeUseCase {
  constructor(private readonly knowledgeRepo: KnowledgeRepository) {}

  async execute(tenantId: string, documentId: string): Promise<Result<true, DomainError>> {
    const document = await this.knowledgeRepo.findDocumentById(documentId);
    if (!document || document.tenantId !== tenantId) {
      return err(new DomainError('KNOWLEDGE_NOT_FOUND', 'Ese documento no existe en la base de conocimiento.'));
    }
    await this.knowledgeRepo.deleteDocument(documentId);
    return ok(true);
  }
}
