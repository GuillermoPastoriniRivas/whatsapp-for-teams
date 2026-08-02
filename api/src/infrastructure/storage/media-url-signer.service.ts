import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  MediaUrlClaims,
  MediaUrlSignerPort,
  MediaVariant,
  SignedMediaUrl,
} from '../../application/ports/media-url-signer.port.js';

const VARIANTS: MediaVariant[] = ['raw', 'thumb-256', 'thumb-1024'];

@Injectable()
export class MediaUrlSignerService implements MediaUrlSignerPort {
  private readonly secret: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('media.urlSecret')!;
    this.baseUrl = config.get<string>('media.publicBaseUrl')!.replace(/\/+$/, '');
  }

  sign(claims: MediaUrlClaims, ttlSeconds: number): SignedMediaUrl {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const payload = this.encode(claims, Math.floor(expiresAt.getTime() / 1000));
    const token = `${payload}.${this.hmac(payload)}`;

    return {
      url: `${this.baseUrl}/api/media/${claims.assetId}/raw?t=${token}`,
      expiresAt,
    };
  }

  verify(token: string): MediaUrlClaims | null {
    const separator = token.lastIndexOf('.');
    if (separator <= 0) return null;

    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);

    if (!this.signatureMatches(payload, signature)) return null;

    const [assetId, variant, expRaw, downloadRaw] = payload.split('~');
    const exp = Number(expRaw);
    if (!assetId || !Number.isFinite(exp)) return null;
    if (exp * 1000 <= Date.now()) return null;
    if (!VARIANTS.includes(variant as MediaVariant)) return null;

    return {
      assetId,
      variant: variant as MediaVariant,
      download: downloadRaw === '1',
    };
  }

  private encode(claims: MediaUrlClaims, exp: number): string {
    return [claims.assetId, claims.variant, exp, claims.download ? '1' : '0'].join('~');
  }

  private hmac(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  private signatureMatches(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.hmac(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }
}
