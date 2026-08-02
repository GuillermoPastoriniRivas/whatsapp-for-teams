/**
 * Caché del `media_id` que Meta devuelve al subir un archivo.
 *
 * Los ids están atados al número de teléfono que hizo el upload: un tenant con
 * tres números necesita tres uploads del mismo archivo. Sin esta tabla, una
 * campaña de 10.000 envíos subiría el mismo adjunto 10.000 veces.
 */
export class MediaProviderRef {
  constructor(
    public readonly id: string,
    public readonly assetId: string,
    public readonly phoneNumberId: string,
    public readonly providerMediaId: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}

  isValid(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() > now.getTime();
  }
}
