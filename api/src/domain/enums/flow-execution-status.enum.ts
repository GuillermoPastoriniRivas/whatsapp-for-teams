export enum FlowExecutionStatus {
  RUNNING = 'running',
  WAITING = 'waiting',
  /**
   * Alguien apagó el piloto automático del chat (o escribió a mano). La
   * ejecución queda viva y conserva su punto: al volver a prender el piloto se
   * retoma donde estaba. Es lo que antes era una cancelación sin vuelta atrás.
   */
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
