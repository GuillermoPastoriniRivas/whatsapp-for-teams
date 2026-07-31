import { FlowConnection } from '../entities/flow-connection.entity.js';

export type CreateFlowConnectionInput = Omit<FlowConnection, 'id' | 'createdAt' | 'updatedAt'>;

export interface FlowConnectionRepository {
  create(input: CreateFlowConnectionInput): Promise<FlowConnection>;
  findById(id: string): Promise<FlowConnection | null>;
  findByTenantId(tenantId: string): Promise<FlowConnection[]>;
  delete(id: string): Promise<void>;
}
