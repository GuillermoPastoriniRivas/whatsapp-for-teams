export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export class PushSubscription {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly agentId: string,
    public readonly endpoint: string,
    public readonly keys: PushSubscriptionKeys,
    public readonly userAgent: string | null,
    public readonly createdAt: Date,
  ) {}
}
