import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import { Flow } from '../../../domain/entities/flow.entity.js';
import { FlowVersion } from '../../../domain/entities/flow-version.entity.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowNotFoundError } from '../../../domain/errors/domain-errors.js';

export class GetFlowUseCase {
  constructor(
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<Result<{ flow: Flow; publishedVersion: FlowVersion | null }, DomainError>> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) return err(new FlowNotFoundError());
    const publishedVersion = flow.publishedVersionId ? await this.versionRepo.findById(flow.publishedVersionId) : null;
    return ok({ flow, publishedVersion });
  }
}
