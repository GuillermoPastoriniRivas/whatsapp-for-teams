export interface JobQueuePort {
  enqueue(jobName: string, data: unknown): Promise<void>;
  schedule(jobName: string, data: unknown, when: Date): Promise<void>;
}
