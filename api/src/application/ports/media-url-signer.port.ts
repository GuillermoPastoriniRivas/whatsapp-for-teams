export type MediaVariant = 'raw' | 'thumb-256' | 'thumb-1024';

export interface SignedMediaUrl {
  url: string;
  expiresAt: Date;
}

export interface MediaUrlClaims {
  assetId: string;
  variant: MediaVariant;
  download: boolean;
}

/**
 * Firma las URLs del proxy de media.
 *
 * Hace falta porque un `<img src>` no puede mandar el header Authorization: la
 * autorización viaja en un token corto en la query, con el mismo espíritu que
 * una URL prefirmada de S3.
 */
export interface MediaUrlSignerPort {
  sign(claims: MediaUrlClaims, ttlSeconds: number): SignedMediaUrl;
  /** `null` si el token es inválido, fue manipulado o venció. */
  verify(token: string): MediaUrlClaims | null;
}
