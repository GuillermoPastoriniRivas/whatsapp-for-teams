import { ConversationLabel } from '../../../domain/entities/conversation-label.entity.js';
import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { Result, ok, err } from '../../common/result.js';
import { ConversationNotFoundError, LabelNotFoundError, LabelAlreadyAssignedError } from '../../../domain/errors/domain-errors.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';

export interface AssignLabelInput {
  conversationId: string;
  labelId: string;
  agentId: string;
  tenantId: string;
}

export class AssignLabelUseCase {
  constructor(
    private readonly convLabelRepo: ConversationLabelRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly labelRepo: LabelRepository,
    private readonly agentRepo: AgentRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: AssignLabelInput): Promise<Result<ConversationLabel, ConversationNotFoundError | LabelNotFoundError | LabelAlreadyAssignedError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    const label = await this.labelRepo.findById(input.labelId);
    if (!label || label.tenantId !== input.tenantId) return err(new LabelNotFoundError());

    try {
      const convLabel = await this.convLabelRepo.create({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        labelId: input.labelId,
        assignedBy: input.agentId,
      });

      const agent = await this.agentRepo.findById(input.agentId);
      const agentName = agent?.name ?? 'Unknown';

      await this.eventRepo.create({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        type: ConversationEventType.LABEL_ADDED,
        performedBy: input.agentId,
        data: { agentName, labelName: label.name, labelColor: label.color },
      });

      this.gateway.emitToConversation(input.conversationId, 'label.assigned', {
        conversationId: input.conversationId,
        label: { id: label.id, name: label.name, color: label.color },
      });
      this.gateway.emitToTenant(input.tenantId, 'conversation.updated', { conversationId: input.conversationId });

      return ok(convLabel);
    } catch (error: any) {
      if (error?.code === 11000) return err(new LabelAlreadyAssignedError());
      throw error;
    }
  }
}
