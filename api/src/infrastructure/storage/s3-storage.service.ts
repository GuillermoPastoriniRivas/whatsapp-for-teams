import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  SignedUrl,
  SignedUrlParams,
  StoragePort,
  StoragePutParams,
} from '../../application/ports/storage.port.js';

/**
 * Bucket privado, sin acceso público. La lectura sale por URLs firmadas de
 * corta vida y el envío a WhatsApp nunca usa una URL: sube los bytes y manda
 * el `media_id`.
 */
@Injectable()
export class S3StorageService implements StoragePort {
  readonly provider = 's3';
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('MEDIA_S3_BUCKET', '');
    const region = config.get<string>('MEDIA_S3_REGION') ?? config.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!this.bucket) {
      this.logger.warn('MEDIA_S3_BUCKET sin configurar: la media library queda deshabilitada.');
      this.client = null;
      return;
    }

    this.client = new S3Client({
      region,
      // Sin claves explícitas cae al rol IAM de la instancia, que es como
      // corre en el EC2 (mismo criterio que SES).
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private requireClient(): S3Client {
    if (!this.client) throw new Error('Storage S3 no configurado (falta MEDIA_S3_BUCKET).');
    return this.client;
  }

  async put(params: StoragePutParams): Promise<void> {
    await this.requireClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        // Sin el ContentType correcto, cualquier consumidor de la URL firmada
        // recibe octet-stream y el navegador no sabe renderizarlo.
        ContentType: params.contentType,
        ServerSideEncryption: 'AES256',
        Metadata: params.metadata,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.requireClient().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.requireClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.requireClient().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(params: SignedUrlParams): Promise<SignedUrl | null> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ...(params.contentType ? { ResponseContentType: params.contentType } : {}),
      ...(params.downloadFilename
        ? {
            ResponseContentDisposition: `attachment; filename="${sanitizeFilename(params.downloadFilename)}"`,
          }
        : {}),
    });

    const url = await getSignedUrl(this.requireClient(), command, {
      expiresIn: params.expiresInSeconds,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + params.expiresInSeconds * 1000),
    };
  }
}

/** Evita romper el header con comillas o saltos de línea inyectados. */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
}
