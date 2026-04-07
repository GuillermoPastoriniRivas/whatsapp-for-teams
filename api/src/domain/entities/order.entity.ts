import { OrderStatus } from '../enums/order-status.enum.js';

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

export class Order {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly conversationId: string,
    public readonly contactId: string,
    public readonly phoneNumberId: string,
    public readonly createdByAgentId: string | null,
    public readonly status: OrderStatus,
    public readonly items: OrderItem[],
    public readonly deliveryType: 'delivery' | 'pickup',
    public readonly deliveryAddress: string | null,
    public readonly deliveryNotes: string | null,
    public readonly estimatedTotal: number | null,
    public readonly currency: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
