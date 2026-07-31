import { FlowVersion } from '../entities/flow-version.entity.js';

export type CreateFlowVersionInput = Omit<FlowVersion, 'id' | 'createdAt'>;

export interface FlowVersionRepository {
  create(input: CreateFlowVersionInput): Promise<FlowVersion>;
  findById(id: string): Promise<FlowVersion | null>;
  /** Bulk por ids (matching de triggers sobre versiones publicadas) */
  findByIds(ids: string[]): Promise<FlowVersion[]>;
  /** Historial de un flujo, versión descendente */
  findByFlowId(flowId: string): Promise<FlowVersion[]>;
  findLatestByFlowId(flowId: string): Promise<FlowVersion | null>;
}
