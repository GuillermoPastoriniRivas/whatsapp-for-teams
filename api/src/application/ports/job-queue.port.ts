export interface JobQueuePort {
  enqueue(jobName: string, data: unknown): Promise<void>;
  schedule(jobName: string, data: unknown, when: Date): Promise<void>;
  /**
   * Job recurrente (mantenimiento). Upsert por nombre: seguro ante restarts,
   * nunca crea cadenas duplicadas.
   */
  every(interval: string, jobName: string): Promise<void>;
}
