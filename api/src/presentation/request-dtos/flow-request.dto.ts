import { z } from 'zod';
import { NODE_TYPES } from '../../application/use-cases/flow/engine/flow-node-types.js';

// Validación ESTRUCTURAL del grafo (el borrador puede estar incompleto; la
// validación semántica profunda corre en publish con flow-graph.validator).
export const FlowGraphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        type: z.enum(NODE_TYPES as unknown as [string, ...string[]]),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
  edges: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        source: z.string().min(1),
        sourceHandle: z.string().min(1).max(64),
        target: z.string().min(1),
      }),
    )
    .max(300),
});

export const CreateFlowRequestSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  templateId: z.string().max(60).optional(),
});
export type CreateFlowRequestDto = z.infer<typeof CreateFlowRequestSchema>;

export const UpdateFlowRequestSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  draftGraph: FlowGraphSchema.optional(),
  priority: z.number().int().min(0).max(100_000).optional(),
});
export type UpdateFlowRequestDto = z.infer<typeof UpdateFlowRequestSchema>;

export const FlowExecutionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['running', 'waiting', 'completed', 'failed', 'cancelled']).optional(),
});
export type FlowExecutionsQueryDto = z.infer<typeof FlowExecutionsQuerySchema>;

export const FlowStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
export type FlowStatsQueryDto = z.infer<typeof FlowStatsQuerySchema>;

export const CreateFlowConnectionRequestSchema = z.object({
  name: z.string().min(1).max(80),
  headerName: z.string().min(1).max(60).regex(/^[A-Za-z0-9-]+$/, 'Nombre de header inválido'),
  secret: z.string().min(1).max(4096),
});
export type CreateFlowConnectionRequestDto = z.infer<typeof CreateFlowConnectionRequestSchema>;

// Payload del webhook externo: JSON arbitrario acotado.
export const FlowWebhookBodySchema = z.record(z.string(), z.unknown());
export type FlowWebhookBodyDto = z.infer<typeof FlowWebhookBodySchema>;
