import { Logger } from '@nestjs/common';
import { HandoffToHumanUseCase } from '../handoff-to-human.use-case.js';
import type { Directive } from '../../../../domain/services/directive-engine.domain-service.js';

export class HandoffDirectiveHandler {
  private readonly logger = new Logger(HandoffDirectiveHandler.name);

  constructor(
    private readonly handoffUseCase: HandoffToHumanUseCase,
  ) {}

  /**
   * Returns true if a handoff directive was found and executed.
   * The caller should still send the response message first (with directives stripped),
   * then this handler triggers the actual handoff.
   */
  async handle(
    directives: Directive[],
    conversationId: string,
    aiAgentId: string,
    tenantId: string,
    conversationSummary: string | null,
  ): Promise<boolean> {
    const handoffDirective = directives.find((d) => d.type === 'HANDOFF' && d.action === 'escalate');
    if (!handoffDirective) return false;

    const reason = handoffDirective.key || 'AI-initiated escalation';

    this.logger.log(`AI agent ${aiAgentId} initiated handoff: ${reason}`);

    await this.handoffUseCase.execute({
      conversationId,
      aiAgentId,
      tenantId,
      reason,
      summary: conversationSummary ?? undefined,
    });

    return true;
  }
}
