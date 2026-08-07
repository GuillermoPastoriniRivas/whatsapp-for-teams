import { Flow, FlowGraph, FlowStats } from '../entities/flow.entity.js';
import { FlowStatus } from '../enums/flow-status.enum.js';

export type CreateFlowInput = Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>;

export interface UpdateFlowInput {
  name?: string;
  description?: string | null;
  draftGraph?: FlowGraph;
  priority?: number;
  publishedVersionId?: string | null;
  publishedVersion?: number | null;
  webhookToken?: string | null;
  status?: FlowStatus;
}

export interface FlowRepository {
  create(input: CreateFlowInput): Promise<Flow>;
  findById(id: string): Promise<Flow | null>;
  /** Todos los flujos del tenant (sin archivados), ordenados por priority asc */
  findByTenantId(tenantId: string): Promise<Flow[]>;
  /** Flujos publicados del tenant, ordenados por priority asc (matching de triggers) */
  findPublishedByTenantId(tenantId: string): Promise<Flow[]>;
  /** La automatización base de un número, en cualquier estado. Null si no la tiene. */
  findDefaultByPhoneNumberId(phoneNumberId: string): Promise<Flow | null>;
  update(id: string, patch: UpdateFlowInput): Promise<Flow | null>;
  /** Transición CAS de estado (patrón transitionStatus de Campaign) */
  transitionStatus(id: string, from: FlowStatus[], to: FlowStatus, extra?: UpdateFlowInput): Promise<Flow | null>;
  incrementStats(id: string, delta: Partial<FlowStats>): Promise<void>;
}
