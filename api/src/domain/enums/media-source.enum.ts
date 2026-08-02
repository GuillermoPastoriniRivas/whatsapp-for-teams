export enum MediaSource {
  /** Llegó por webhook desde un contacto. */
  INBOUND = 'inbound',
  /** Un agente lo subió desde la bandeja. */
  AGENT_UPLOAD = 'agent_upload',
  /** Subido directo a la biblioteca (no atado a una conversación). */
  LIBRARY_UPLOAD = 'library_upload',
  /** Subido vía la API pública de desarrolladores. */
  API = 'api',
  /** Adjuntado a una campaña. */
  CAMPAIGN = 'campaign',
}
