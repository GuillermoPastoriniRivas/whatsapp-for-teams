import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { ConversationEventRepository } from '../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { ConversationEventType } from '../../../domain/enums/conversation-event-type.enum.js';
import { OrderStatus } from '../../../domain/enums/order-status.enum.js';
import { Order, OrderItem } from '../../../domain/entities/order.entity.js';
import { Result, ok } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

export interface CreateOrderInput {
  tenantId: string;
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  createdByAgentId: string | null;
  items: OrderItem[];
  deliveryType: 'delivery' | 'pickup';
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  estimatedTotal?: number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryCost?: number | null;
  neighborhood?: string | null;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: CreateOrderInput): Promise<Result<Order, DomainError>> {
    const order = await this.orderRepo.create({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      phoneNumberId: input.phoneNumberId,
      createdByAgentId: input.createdByAgentId,
      status: OrderStatus.PENDING,
      items: input.items,
      deliveryType: input.deliveryType,
      deliveryAddress: input.deliveryAddress ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      estimatedTotal: input.estimatedTotal ?? null,
      currency: input.currency ?? null,
      paymentMethod: input.paymentMethod ?? null,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      deliveryCost: input.deliveryCost ?? null,
      neighborhood: input.neighborhood ?? null,
    });

    await this.eventRepo.create({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      type: ConversationEventType.ORDER_CREATED,
      performedBy: input.createdByAgentId,
      data: {
        orderId: order.id,
        itemCount: order.items.length,
        deliveryType: order.deliveryType,
        estimatedTotal: order.estimatedTotal,
      },
    });

    this.gateway.emitToTenant(input.tenantId, 'order.new', order);

    return ok(order);
  }
}
