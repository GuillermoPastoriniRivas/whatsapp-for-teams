import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { WebPushPort, WebPushTarget, PushSubscriptionGoneError } from '../../application/ports/web-push.port.js';

@Injectable()
export class WebPushService implements WebPushPort {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey: string | null = null;
  private readonly configured: boolean = false;

  constructor(config: ConfigService) {
    const publicKey = config.get<string>('vapid.publicKey');
    const privateKey = config.get<string>('vapid.privateKey');
    const subject = config.get<string>('vapid.subject') ?? 'mailto:no-reply@asis.chat';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
      this.configured = true;
    } else {
      this.logger.warn('VAPID keys not configured — web push notifications are disabled');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async sendNotification(target: WebPushTarget, payload: string): Promise<void> {
    if (!this.configured) return;
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: target.keys },
        payload,
      );
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        throw new PushSubscriptionGoneError();
      }
      throw err;
    }
  }
}
