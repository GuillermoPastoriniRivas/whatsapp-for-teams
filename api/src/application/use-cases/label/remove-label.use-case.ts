import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';

export interface RemoveLabelInput {
  conversationId: string;
  labelId: string;
  agentId: string;
  tenantId: string;
}

export class RemoveLabelUseCase {
  constructor(
    private readonly convLabelRepo: ConversationLabelRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly labelRepo: LabelRepository,
    private readonly agentRepo: AgentRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: RemoveLabelInput): Promise<Result<void, ConversationNotFoundError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    const label = await this.labelRepo.findById(input.labelId);
    const labelName = label?.name ?? 'Unknown';
    const labelColor = label?.color ?? 'gray';

    await this.convLabelRepo.delete(input.conversationId, input.labelId);

    const agent = await this.agentRepo.findById(input.agentId);
    const agentName = agent?.name ?? 'Unknown';

    await this.eventRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      type: ConversationEventType.LABEL_REMOVED,
      performedBy: input.agentId,
      data: { agentName, labelName, labelColor },
    });

    this.gateway.emitToConversation(input.conversationId, 'label.removed', {
      conversationId: input.conversationId,
      labelId: input.labelId,
    });
    this.gateway.emitToTenant(input.tenantId, 'conversation.updated', { conversationId: input.conversationId });

    return ok(undefined);
  }
}
