import { Controller, Get, Post, Delete, Body, Param, Inject, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IngestKnowledgeUseCase,
  ListKnowledgeUseCase,
  DeleteKnowledgeUseCase,
} from '../../application/use-cases/knowledge/knowledge.use-cases.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateKnowledgeRequestSchema } from '../request-dtos/knowledge-request.dto.js';
import type { CreateKnowledgeRequestDto } from '../request-dtos/knowledge-request.dto.js';
import { DomainError } from '../../domain/errors/domain-errors.js';

const KNOWLEDGE_ERROR_STATUS: Record<string, number> = {
  KNOWLEDGE_NOT_FOUND: 404,
  KNOWLEDGE_TITLE_REQUIRED: 422,
  KNOWLEDGE_TEXT_REQUIRED: 422,
  KNOWLEDGE_TOO_LARGE: 422,
  KNOWLEDGE_LIMIT_REACHED: 409,
  KNOWLEDGE_INDEXING_FAILED: 502,
};

@ApiTags('Knowledge')
@ApiBearerAuth('JWT')
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    @Inject('IngestKnowledgeUseCase') private readonly ingest: IngestKnowledgeUseCase,
    @Inject('ListKnowledgeUseCase') private readonly list: ListKnowledgeUseCase,
    @Inject('DeleteKnowledgeUseCase') private readonly remove: DeleteKnowledgeUseCase,
  ) {}

  private fail(error: DomainError): never {
    throw new HttpException({ code: error.code, message: error.message }, KNOWLEDGE_ERROR_STATUS[error.code] ?? 400);
  }

  @Get()
  @ApiOperation({ summary: 'What the assistant can look up' })
  async listDocuments(@CurrentAgent() agent: RequestAgent) {
    const documents = await this.list.execute(agent.tenantId);
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      sourceRef: doc.sourceRef,
      chunkCount: doc.chunkCount,
      characterCount: doc.characterCount,
      createdAt: doc.createdAt,
    }));
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Index a document so the assistant can answer from it' })
  async create(
    @Body(new ZodValidationPipe(CreateKnowledgeRequestSchema)) body: CreateKnowledgeRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.ingest.execute({
      tenantId: agent.tenantId,
      title: body.title,
      text: body.text,
      source: body.source,
      sourceRef: body.sourceRef ?? null,
    });
    if (!result.ok) this.fail(result.error as DomainError);
    return { id: result.value.id, title: result.value.title, chunkCount: result.value.chunkCount };
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Remove a document and everything indexed from it' })
  async removeDocument(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.remove.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error as DomainError);
    return { deleted: true };
  }
}
