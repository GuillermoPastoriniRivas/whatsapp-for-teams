import { EvaluationCase, EvaluationRun } from '../entities/evaluation.entity.js';

export interface EvaluationRepository {
  createCase(input: Omit<EvaluationCase, 'id' | 'createdAt'>): Promise<EvaluationCase>;
  findCasesByTenantId(tenantId: string): Promise<EvaluationCase[]>;
  findCaseById(id: string): Promise<EvaluationCase | null>;
  deleteCase(id: string): Promise<void>;

  createRun(input: Omit<EvaluationRun, 'id' | 'createdAt'>): Promise<EvaluationRun>;
  findLastRun(tenantId: string): Promise<EvaluationRun | null>;
}
