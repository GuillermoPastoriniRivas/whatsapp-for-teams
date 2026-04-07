import { Order } from '../entities/order.entity.js';
import { OrderStatus } from '../enums/order-status.enum.js';

export interface OrderFilters {
  tenantId: string;
  status?: OrderStatus;
  phoneNumberId?: string;
  page: number;
  limit: number;
}

export interface PaginatedOrders {
  data: Order[];
  meta: { total: number; page: number; pages: number };
}

export interface OrderRepository {
  create(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByConversationId(conversationId: string): Promise<Order[]>;
  findByFilters(filters: OrderFilters): Promise<PaginatedOrders>;
  updateStatus(id: string, status: OrderStatus): Promise<Order | null>;
}
