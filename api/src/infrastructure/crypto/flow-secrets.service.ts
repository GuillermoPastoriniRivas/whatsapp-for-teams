import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { FlowSecretsPort } from '../../application/ports/flow-secrets.port.js';

/**
 * Cifrado AES-256-GCM para secretos de conexiones de flujos. La key viene de
 * env FLOW_SECRETS_KEY (cualquier string; se deriva con SHA-256). Formato:
 * base64(iv).base64(tag).base64(ciphertext)
 */
@Injectable()
export class FlowSecretsService implements FlowSecretsPort {
  private cachedKey: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  // Lazy: la app puede bootear sin FLOW_SECRETS_KEY; solo falla al usar conexiones.
  private get key(): Buffer {
    if (!this.cachedKey) {
      const secret = this.config.get<string>('FLOW_SECRETS_KEY');
      if (!secret) {
        throw new Error('FLOW_SECRETS_KEY env var is required to store flow connection secrets');
      }
      this.cachedKey = createHash('sha256').update(secret).digest();
    }
    return this.cachedKey;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivB64, tagB64, dataB64] = ciphertext.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  }
}
