import { Logger } from '@nestjs/common';
import { CreateOrderUseCase } from '../../order/create-order.use-case.js';
import type { Directive } from '../../../../domain/services/directive-engine.domain-service.js';

export class OrderDirectiveHandler {
  private readonly logger = new Logger(OrderDirectiveHandler.name);

  constructor(private readonly createOrder: CreateOrderUseCase) {}

  async handle(
    directives: Directive[],
    conversationId: string,
    contactId: string,
    phoneNumberId: string,
    tenantId: string,
  ): Promise<void> {
    const orderDirectives = directives.filter(
      (d) => d.type === 'ORDER' && d.action === 'create',
    );

    for (const d of orderDirectives) {
      try {
        const payload = JSON.parse(d.key);

        await this.createOrder.execute({
          tenantId,
          conversationId,
          contactId,
          phoneNumberId,
          createdByAgentId: null,
          items: Array.isArray(payload.items) ? payload.items : [],
          deliveryType: payload.type === 'delivery' ? 'delivery' : 'pickup',
          deliveryAddress: payload.address ?? null,
          deliveryNotes: payload.notes ?? null,
          estimatedTotal: typeof payload.total === 'number' ? payload.total : null,
          currency: payload.currency ?? null,
        });

        this.logger.log(`Order created from AI directive for conversation ${conversationId}`);
      } catch (error) {
        this.logger.warn(`Failed to parse/create order directive: ${error}`);
      }
    }
  }
}
