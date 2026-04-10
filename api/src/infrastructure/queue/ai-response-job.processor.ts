import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { ProcessAiResponseUseCase } from '../../application/use-cases/ai/process-ai-response.use-case.js';

export const AI_RESPONSE_JOB = 'ai.process-response';

export interface AiResponseJobData {
  conversationId: string;
  messageBody?: string;
  scheduledFor?: string;
}

@Injectable()
export class AiResponseJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(AiResponseJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('ProcessAiResponseUseCase') private readonly processAi: ProcessAiResponseUseCase,
  ) {}

  onModuleInit(): void {
    this.queue.define(AI_RESPONSE_JOB, async (data) => {
      const { conversationId, messageBody, scheduledFor } = data as AiResponseJobData;
      this.logger.debug(`Processing AI response for conversation ${conversationId}`);
      await this.processAi.execute({ conversationId, messageBody, scheduledFor });
    }, 3); // concurrency: 3 AI responses at a time
  }
}
