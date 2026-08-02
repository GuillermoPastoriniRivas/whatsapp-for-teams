import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service.js';
import { LocalDiskStorageService } from './local-disk-storage.service.js';
import { DisabledStorageService } from './disabled-storage.service.js';
import { ImageProcessorService } from './image-processor.service.js';
import { MediaUrlSignerService } from './media-url-signer.service.js';
import type { StoragePort } from '../../application/ports/storage.port.js';

/**
 * Elección explícita del backend, sin magia:
 *   MEDIA_S3_BUCKET  → S3 (producción)
 *   MEDIA_LOCAL_PATH → disco (desarrollo)
 *   ninguno          → deshabilitado: toda la instalación opera passthrough
 */
@Module({
  providers: [
    ImageProcessorService,
    MediaUrlSignerService,
    { provide: 'ImageProcessorPort', useExisting: ImageProcessorService },
    { provide: 'MediaUrlSignerPort', useExisting: MediaUrlSignerService },
    {
      provide: 'StoragePort',
      inject: [ConfigService],
      useFactory: (config: ConfigService): StoragePort => {
        if (config.get<string>('MEDIA_S3_BUCKET')) return new S3StorageService(config);
        if (config.get<string>('MEDIA_LOCAL_PATH')) return new LocalDiskStorageService(config);
        return new DisabledStorageService();
      },
    },
  ],
  exports: ['StoragePort', 'MediaUrlSignerPort', 'ImageProcessorPort'],
})
export class StorageModule {}
