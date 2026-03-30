import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agenda } from '@hokify/agenda';
import type { JobQueuePort } from '../../application/ports/job-queue.port.js';

export type JobHandler = (data: unknown) => Promise<void>;

@Injectable()
export class AgendaQueueService implements JobQueuePort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgendaQueueService.name);
  private readonly agenda: Agenda;
  private readonly handlers = new Map<string, JobHandler>();

  constructor(private readonly config: ConfigService) {
    const mongoUri = config.get<string>('mongodb.uri')!;

    this.agenda = new Agenda({
      db: { address: mongoUri, collection: 'jobs' },
      processEvery: '500ms',
      maxConcurrency: 10,
      defaultConcurrency: 5,
    });
  }

  /**
   * Register a job handler. Must be called before onModuleInit (i.e. during DI setup).
   */
  define(jobName: string, handler: JobHandler, concurrency?: number): void {
    this.handlers.set(jobName, handler);
    this.agenda.define(jobName, async (job) => {
      await handler(job.attrs.data);
    }, { concurrency: concurrency ?? 5 });
  }

  async enqueue(jobName: string, data: unknown): Promise<void> {
    await this.agenda.now(jobName, data as any);
  }

  async onModuleInit(): Promise<void> {
    await this.agenda.start();
    this.logger.log(`Agenda started – processing jobs: [${[...this.handlers.keys()].join(', ')}]`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.agenda.stop();
    this.logger.log('Agenda stopped');
  }
}
