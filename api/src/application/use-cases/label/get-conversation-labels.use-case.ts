import { ConversationLabelRepository } from '../../../domain/repositories/conversation-label.repository.js';
import { LabelRepository } from '../../../domain/repositories/label.repository.js';

export interface EnrichedConversationLabel {
  id: string;
  labelId: string;
  labelName: string;
  labelColor: string;
  assignedBy: string;
  createdAt: Date;
}

export class GetConversationLabelsUseCase {
  constructor(
    private readonly convLabelRepo: ConversationLabelRepository,
    private readonly labelRepo: LabelRepository,
  ) {}

  async execute(conversationId: string): Promise<EnrichedConversationLabel[]> {
    const convLabels = await this.convLabelRepo.findByConversationId(conversationId);
    if (convLabels.length === 0) return [];

    const labelIds = [...new Set(convLabels.map((cl) => cl.labelId))];
    const labels = await this.labelRepo.findByIds(labelIds);
    const labelMap = new Map(labels.map((l) => [l.id, l]));

    return convLabels
      .map((cl) => {
        const label = labelMap.get(cl.labelId);
        if (!label) return null;
        return {
          id: cl.id,
          labelId: cl.labelId,
          labelName: label.name,
          labelColor: label.color,
          assignedBy: cl.assignedBy,
          createdAt: cl.createdAt,
        };
      })
      .filter((item): item is EnrichedConversationLabel => item !== null);
  }
}
