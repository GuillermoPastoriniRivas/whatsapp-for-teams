import { Injectable } from '@nestjs/common';
import {
  SignedUrl,
  StoragePort,
  StoragePutParams,
} from '../../application/ports/storage.port.js';

/**
 * Null object para cuando no hay backend configurado. Toda la instalación
 * opera en passthrough: los archivos viven en Meta y se pierden a los 30 días.
 */
@Injectable()
export class DisabledStorageService implements StoragePort {
  readonly provider = 'none';
  readonly enabled = false;

  private fail(): never {
    throw new Error('No hay storage configurado (definí MEDIA_S3_BUCKET o MEDIA_LOCAL_PATH).');
  }

  async put(_params: StoragePutParams): Promise<void> {
    this.fail();
  }

  async get(_key: string): Promise<Buffer> {
    this.fail();
  }

  async delete(_key: string): Promise<void> {
    // borrar sin storage es un no-op, no un error
  }

  async exists(_key: string): Promise<boolean> {
    return false;
  }

  async signedUrl(): Promise<SignedUrl | null> {
    return null;
  }
}
