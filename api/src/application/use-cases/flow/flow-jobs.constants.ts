// Nombres y payloads de los jobs de Agenda del motor de flujos.
// maxRetries SIEMPRE 1 en execute/resume: un retry automático re-enviaría
// mensajes de WhatsApp. Solo jobs cuyo efecto está cercado por token CAS
// pueden reintentarse.

export const FLOW_EXECUTE_JOB = 'flow.execute';
export const FLOW_RESUME_JOB = 'flow.resume';
export const FLOW_SWEEP_JOB = 'flow.sweep';

export interface FlowExecuteJobData {
  executionId: string;
  token: string;
}

export interface FlowResumeJobData {
  executionId: string;
  token: string;
  reason: 'reply' | 'timeout';
  messageId?: string;
  interactiveReplyId?: string | null;
  body?: string | null;
}
