import { FlowNodeStat } from '../entities/flow-node-stat.entity.js';

export interface FlowNodeStatRepository {
  /** Upsert $inc atómico (patrón MongoAiUsageRepository) */
  increment(
    tenantId: string,
    flowId: string,
    flowVersionId: string,
    nodeId: string,
    date: string,
    delta: { entered?: number; errors?: number; outcomeHandle?: string },
  ): Promise<void>;
  /** Filas desde una fecha (el use case agrega por nodo) */
  findByFlowId(flowId: string, fromDate: string): Promise<FlowNodeStat[]>;
}
