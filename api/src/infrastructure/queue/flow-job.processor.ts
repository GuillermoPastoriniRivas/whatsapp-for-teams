import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';
import { FlowEngineService } from '../../application/use-cases/flow/engine/flow-engine.service.js';
import {
  FLOW_EXECUTE_JOB,
  FLOW_RESUME_JOB,
  FLOW_SWEEP_JOB,
  FlowExecuteJobData,
  FlowResumeJobData,
} from '../../application/use-cases/flow/flow-jobs.constants.js';

@Injectable()
export class FlowJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(FlowJobProcessor.name);

  constructor(
    private readonly queue: AgendaQueueService,
    @Inject('FlowEngineService') private readonly engine: FlowEngineService,
  ) {}

  async onModuleInit(): Promise<void> {
    // maxRetries 1: un retry automático re-enviaría mensajes de WhatsApp.
    // Solo el sweep (idempotente por CAS) tolera reintentos.
    this.queue.define(FLOW_EXECUTE_JOB, async (data) => {
      const input = data as FlowExecuteJobData;
      await this.engine.runExecution(input.executionId, input.token);
    }, 5, 1);

    this.queue.define(FLOW_RESUME_JOB, async (data) => {
      await this.engine.resume(data as FlowResumeJobData);
    }, 5, 1);

    this.queue.define(FLOW_SWEEP_JOB, async () => {
      await this.engine.sweep();
    }, 1, 2);

    await this.queue.every('5 minutes', FLOW_SWEEP_JOB);
    this.logger.log('Flow jobs registered (execute/resume/sweep)');
  }
}
