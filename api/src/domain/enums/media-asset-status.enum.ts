export enum MediaAssetStatus {
  /** Plan free (passthrough): solo vive en Meta y muere a los 30 días. */
  META_ONLY = 'meta_only',
  /** Plan pago: encolado para bajar a nuestro storage. */
  PENDING = 'pending',
  /** Plan pago: los bytes son nuestros. */
  READY = 'ready',
  /** La ingesta falló y se agotaron los reintentos. */
  FAILED = 'failed',
  /** Se venció en Meta (30 días) antes de que pudiéramos bajarlo. */
  EXPIRED_AT_SOURCE = 'expired_at_source',
}
