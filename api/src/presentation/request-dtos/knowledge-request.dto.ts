import { z } from 'zod';
import { MAX_DOCUMENT_CHARS } from '../../application/use-cases/knowledge/knowledge.use-cases.js';

export const CreateKnowledgeRequestSchema = z.object({
  title: z.string().min(1).max(200),
  text: z.string().min(1).max(MAX_DOCUMENT_CHARS),
  source: z.enum(['text', 'url', 'file']).default('text'),
  sourceRef: z.string().max(2000).nullish(),
});
export type CreateKnowledgeRequestDto = z.infer<typeof CreateKnowledgeRequestSchema>;
