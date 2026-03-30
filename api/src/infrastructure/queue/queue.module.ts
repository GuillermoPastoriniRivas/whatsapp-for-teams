import { Module } from '@nestjs/common';
import { AgendaQueueService } from './agenda-queue.service.js';

@Module({
  providers: [
    AgendaQueueService,
    { provide: 'JobQueuePort', useExisting: AgendaQueueService },
  ],
  exports: ['JobQueuePort', AgendaQueueService],
})
export class QueueModule {}
