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
  define(jobName: string, handler: JobHandler, concurrency?: number, maxRetries = 3): void {
    this.handlers.set(jobName, handler);
    this.agenda.define(jobName, async (job) => {
      const attempt = (job.attrs.failCount ?? 0) + 1;
      try {
        await handler(job.attrs.data);
      } catch (error: any) {
        this.logger.error(`Job "${jobName}" failed (attempt ${attempt}/${maxRetries}): ${error.message}`, error.stack);

        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
          this.logger.log(`Job "${jobName}" will retry in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          job.attrs.nextRunAt = new Date(Date.now() + delayMs);
          await job.save();
          return; // don't rethrow — Agenda will re-run at nextRunAt
        }

        this.logger.error(`Job "${jobName}" exhausted ${maxRetries} retries, giving up. Data: ${JSON.stringify(job.attrs.data)}`);
        throw error;
      }
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
