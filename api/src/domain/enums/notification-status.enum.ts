/**
 * Estado de una notificación.
 *
 * Es un estado propio y no el del mensaje de WhatsApp: la notificación es lo
 * que el desarrollador pidió (una plantilla a tal destinatario), y el mensaje es
 * el detalle interno que la usó para salir. Un mensaje puede fallar y que la
 * notificación siga viva; una notificación cancelada nunca sale aunque su
 * mensaje existiera.
 *
 * - `scheduled`: guardada con hora de envío en el futuro.
 * - `queued`: aceptada, esperando salir.
 * - `sent`: salió a Meta (o se simuló en sandbox).
 * - `delivered`: Meta la entregó.
 * - `read`: el destinatario la leyó.
 * - `failed`: no se pudo enviar.
 * - `canceled`: se canceló antes de salir.
 */
export enum NotificationStatus {
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELED = 'canceled',
}
