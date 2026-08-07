import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import { Flow, FlowGraph } from '../../../domain/entities/flow.entity.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { Result, ok } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { getFlowTemplate } from './flow-templates.js';
import { DEFAULT_FLOW_PRIORITY } from './default-phone-flow.js';
import { isTrigger, type PhoneScope } from './engine/flow-node-types.js';

export interface CreateFlowInputDto {
  tenantId: string;
  createdByAgentId: string;
  name: string;
  description?: string;
  templateId?: string;
  /** Alta de la automatización base de un número (ver default-phone-flow) */
  defaultForPhoneNumberId?: string;
  /** Grafo inicial explícito; pisa el del template y el vacío */
  draftGraph?: FlowGraph;
  /** Sobre qué líneas actúa. Se elige en el alta y se estampa en el disparador. */
  phoneScope?: PhoneScope;
  phoneNumberIds?: string[];
}

/**
 * Deja el alcance de líneas elegido en el alta escrito en el disparador. Las
 * plantillas vienen con la lista vacía porque no saben a qué número van; sin
 * esto, un flujo recién creado arrancaba aplicando a todos los números sin que
 * nadie lo hubiera pedido.
 */
function stampPhoneScope(graph: FlowGraph, scope: PhoneScope, phoneNumberIds: string[]): FlowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      isTrigger(node.type)
        ? {
            ...node,
            data: {
              ...node.data,
              phoneScope: scope,
              phoneNumberIds: scope === 'all' ? [] : phoneNumberIds,
            },
          }
        : node,
    ),
  };
}

const EMPTY_GRAPH: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger.inbound_message',
      position: { x: 80, y: 200 },
      data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: false },
    },
  ],
  edges: [],
};

function buildInitialGraph(input: CreateFlowInputDto, template: { graph: FlowGraph } | null): FlowGraph {
  // Un grafo explícito ya viene armado por quien lo pidió (la automatización
  // base de un número): no se le toca el disparador.
  if (input.draftGraph) return input.draftGraph;
  const base = template ? template.graph : EMPTY_GRAPH;
  if (!input.phoneScope) return base;
  return stampPhoneScope(base, input.phoneScope, input.phoneNumberIds ?? []);
}

export class CreateFlowUseCase {
  constructor(private readonly flowRepo: FlowRepository) {}

  async execute(input: CreateFlowInputDto): Promise<Result<Flow, DomainError>> {
    const template = input.templateId ? getFlowTemplate(input.templateId) : null;
    const existing = await this.flowRepo.findByTenantId(input.tenantId);
    // Las base no entran en la cuenta: si entraran, el primer flujo común que
    // se cree después nacería con prioridad 1.000.010 y quedaría detrás de la
    // base, que es justo lo que la base tiene prohibido.
    const maxPriority = existing
      .filter((f) => !f.defaultForPhoneNumberId)
      .reduce((max, f) => Math.max(max, f.priority), 0);

    const flow = await this.flowRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      status: FlowStatus.DRAFT,
      draftGraph: buildInitialGraph(input, template),
      publishedVersionId: null,
      publishedVersion: null,
      priority: input.defaultForPhoneNumberId ? DEFAULT_FLOW_PRIORITY : maxPriority + 10,
      webhookToken: null,
      stats: { started: 0, completed: 0, failed: 0, cancelled: 0 },
      createdByAgentId: input.createdByAgentId,
      defaultForPhoneNumberId: input.defaultForPhoneNumberId ?? null,
    });
    return ok(flow);
  }
}
