import { PushSubscriptionRepository } from '../../../domain/repositories/push-subscription.repository.js';
import { WebPushPort, PushSubscriptionGoneError } from '../../ports/web-push.port.js';

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta del frontend a abrir al tocar la notificación, ej. /conversations/123 */
  url: string;
  /** Mismo tag → las notificaciones se agrupan/reemplazan (ej. conv-<id>) */
  tag?: string;
}

/**
 * Fire-and-forget: nunca lanza. Las suscripciones vencidas (404/410)
 * se eliminan automáticamente.
 */
export class SendPushToAgentUseCase {
  constructor(
    private readonly pushRepo: PushSubscriptionRepository,
    private readonly webPush: WebPushPort,
  ) {}

  async execute(agentId: string, payload: PushPayload): Promise<void> {
    try {
      if (!this.webPush.isConfigured()) return;
      const subscriptions = await this.pushRepo.findByAgentId(agentId);
      if (subscriptions.length === 0) return;

      const json = JSON.stringify(payload);
      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await this.webPush.sendNotification(
              { endpoint: sub.endpoint, keys: sub.keys },
              json,
            );
          } catch (err) {
            if (err instanceof PushSubscriptionGoneError) {
              await this.pushRepo.deleteByEndpoint(sub.endpoint).catch(() => {});
            }
          }
        }),
      );
    } catch {
      // el push nunca debe romper el flujo que lo dispara
    }
  }
}
