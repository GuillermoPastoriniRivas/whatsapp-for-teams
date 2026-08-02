import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile, access } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import {
  SignedUrl,
  SignedUrlParams,
  StoragePort,
  StoragePutParams,
} from '../../application/ports/storage.port.js';

/**
 * Storage en disco para desarrollo y para el tenant demo: levantar la app no
 * debería requerir credenciales de AWS.
 *
 * No sabe firmar URLs — devuelve `null` y el que llama cae al proxy de la API,
 * que es el mismo camino que usa el plan free.
 */
@Injectable()
export class LocalDiskStorageService implements StoragePort {
  readonly provider = 'local';
  readonly enabled = true;
  private readonly logger = new Logger(LocalDiskStorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('MEDIA_LOCAL_PATH', './.media-storage'));
    this.logger.log(`Storage local en ${this.root}`);
  }

  /** Nunca dejar que una key salga del root (path traversal). */
  private pathFor(key: string): string {
    const target = resolve(join(this.root, key));
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error(`Key de storage inválida: ${key}`);
    }
    return target;
  }

  async put(params: StoragePutParams): Promise<void> {
    const path = this.pathFor(params.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, params.body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch {
      // borrar algo que ya no está no es un error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(_params: SignedUrlParams): Promise<SignedUrl | null> {
    return null;
  }
}
