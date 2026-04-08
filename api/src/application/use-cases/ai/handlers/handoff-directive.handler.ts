import { Logger } from '@nestjs/common';
import { HandoffToHumanUseCase } from '../handoff-to-human.use-case.js';

export class HandoffDirectiveHandler {
  private readonly logger = new Logger(HandoffDirectiveHandler.name);

  constructor(
    private readonly handoffUseCase: HandoffToHumanUseCase,
  ) {}

  async handleAction(
    reason: string,
    conversationId: string,
    aiAgentId: string,
    tenantId: string,
    conversationSummary: string | null,
  ): Promise<void> {
    this.logger.log(`AI agent ${aiAgentId} initiated handoff: ${reason}`);

    await this.handoffUseCase.execute({
      conversationId,
      aiAgentId,
      tenantId,
      reason: reason || 'AI-initiated escalation',
      summary: conversationSummary ?? undefined,
    });
  }
}
