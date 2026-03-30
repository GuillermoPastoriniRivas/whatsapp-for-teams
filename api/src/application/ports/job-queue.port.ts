export interface JobQueuePort {
  enqueue(jobName: string, data: unknown): Promise<void>;
}
