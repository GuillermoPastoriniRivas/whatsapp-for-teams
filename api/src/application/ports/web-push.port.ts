import { PushSubscriptionKeys } from '../../domain/entities/push-subscription.entity.js';

export interface WebPushTarget {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

/** Thrown when the push service reports the subscription no longer exists (404/410). */
export class PushSubscriptionGoneError extends Error {
  constructor() {
    super('Push subscription is gone');
    this.name = 'PushSubscriptionGoneError';
  }
}

export interface WebPushPort {
  /** Whether VAPID keys are configured; when false, sends are silently skipped. */
  isConfigured(): boolean;
  getPublicKey(): string | null;
  sendNotification(target: WebPushTarget, payload: string): Promise<void>;
}
