import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { LabelNotFoundError } from '../../../domain/errors/domain-errors.js';

export class DeleteLabelUseCase {
  constructor(
    private readonly labelRepo: LabelRepository,
    private readonly convLabelRepo: ConversationLabelRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(labelId: string, tenantId: string): Promise<Result<void, LabelNotFoundError>> {
    const label = await this.labelRepo.findById(labelId);
    if (!label || label.tenantId !== tenantId) return err(new LabelNotFoundError());

    await this.convLabelRepo.deleteByLabelId(labelId);
    await this.labelRepo.delete(labelId);

    this.gateway.emitToTenant(tenantId, 'label.deleted', { labelId });

    return ok(undefined);
  }
}
