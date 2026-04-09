import { Logger } from '@nestjs/common';
import { CreateOrderUseCase } from '../../order/create-order.use-case.js';

export interface OrderActionParams {
  items: Array<{ name: string; quantity: number; unitPrice: number; notes?: string }>;
  type: string;
  address?: string;
  notes?: string;
  total?: number;
  currency?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryCost?: number;
  neighborhood?: string;
}

export class OrderDirectiveHandler {
  private readonly logger = new Logger(OrderDirectiveHandler.name);

  constructor(private readonly createOrder: CreateOrderUseCase) {}

  async handleAction(
    params: OrderActionParams,
    conversationId: string,
    contactId: string,
    phoneNumberId: string,
    tenantId: string,
  ): Promise<string> {
    const items = Array.isArray(params.items) ? params.items : [];
    if (items.length === 0) {
      this.logger.warn(`Order action with no items for conversation ${conversationId}`);
      return 'No items provided for order';
    }

    this.logger.log(`Creating order: ${items.length} items, total: ${params.total}, type: ${params.type}, conversation: ${conversationId}`);

    const result = await this.createOrder.execute({
      tenantId,
      conversationId,
      contactId,
      phoneNumberId,
      createdByAgentId: null,
      items,
      deliveryType: params.type === 'delivery' ? 'delivery' : 'pickup',
      deliveryAddress: params.address ?? null,
      deliveryNotes: params.notes ?? null,
      estimatedTotal: typeof params.total === 'number' ? params.total : null,
      currency: params.currency ?? null,
      paymentMethod: params.paymentMethod ?? null,
      customerName: params.customerName ?? null,
      customerPhone: params.customerPhone ?? null,
      deliveryCost: typeof params.deliveryCost === 'number' ? params.deliveryCost : null,
      neighborhood: params.neighborhood ?? null,
    });

    if (!result.ok) {
      this.logger.warn(`Order creation failed: ${(result as any).error}`);
      throw new Error(`Order creation failed: ${(result as any).error}`);
    }

    this.logger.log(`Order created: id=${result.value.id}, conversation=${conversationId}`);
    return `Order created successfully (${items.length} items, total: ${params.total ?? 'N/A'})`;
  }
}
