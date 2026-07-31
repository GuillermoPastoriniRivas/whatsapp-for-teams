import { FlowStatus } from '../enums/flow-status.enum.js';

/**
 * Nodo del grafo. Shape compatible con la serialización de @xyflow/react:
 * la config específica del tipo vive en `data`.
 */
export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowStats {
  started: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export class Flow {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly status: FlowStatus,
    /** Grafo en edición; siempre editable, se congela en flow_versions al publicar */
    public readonly draftGraph: FlowGraph,
    public readonly publishedVersionId: string | null,
    public readonly publishedVersion: number | null,
    /** Orden de evaluación de triggers (menor = primero) */
    public readonly priority: number,
    /** Solo flujos con trigger.webhook; 32 bytes hex */
    public readonly webhookToken: string | null,
    public readonly stats: FlowStats,
    public readonly createdByAgentId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
