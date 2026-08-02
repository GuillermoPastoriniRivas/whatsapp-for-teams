export interface StoragePutParams {
  key: string;
  body: Buffer;
  contentType: string;
  /** Metadata libre; en S3 viaja como user-metadata del objeto. */
  metadata?: Record<string, string>;
}

export interface SignedUrlParams {
  key: string;
  expiresInSeconds: number;
  /** Fuerza descarga con este nombre en vez de mostrarlo inline. */
  downloadFilename?: string;
  contentType?: string;
}

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

/**
 * Storage de archivos. Detrás hay S3 en producción y disco local en desarrollo
 * (que nadie necesite credenciales de AWS para levantar la app).
 *
 * La abstracción también deja abierta la migración a R2 —API compatible con
 * S3— si el costo de egress se vuelve dominante.
 */
export interface StoragePort {
  /** Identificador que se guarda en `MediaAsset.storageProvider`. */
  readonly provider: string;
  /** `false` cuando no hay backend configurado: el tenant opera passthrough. */
  readonly enabled: boolean;

  put(params: StoragePutParams): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  /**
   * URL de lectura directa, sin pasar por la API. `null` si el backend no puede
   * firmar (disco local): el que llama cae al proxy.
   */
  signedUrl(params: SignedUrlParams): Promise<SignedUrl | null>;
}
