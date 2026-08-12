import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError } from '../../../domain/errors/domain-errors.js';
import { validateFlowGraph, type FlowGraphIssue } from './engine/flow-graph.validator.js';
import { loadFlowGraphRefs, type FlowGraphRefsDeps } from './flow-graph-refs.loader.js';

export interface CheckFlowResult {
  publishable: boolean;
  errors: FlowGraphIssue[];
  warnings: FlowGraphIssue[];
}

/**
 * Las mismas reglas que corren al publicar, sin publicar. Es la señal de
 * retorno que necesita quien arma el flujo para corregirlo antes de que lo vea
 * un cliente.
 */
export class CheckFlowUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly refs: FlowGraphRefsDeps,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<Result<CheckFlowResult, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());

    const refs = await loadFlowGraphRefs(this.refs, tenantId, flow.draftGraph);
    const { errors, warnings } = validateFlowGraph(flow.draftGraph, refs);
    return ok({ publishable: errors.length === 0, errors, warnings });
  }
}
