import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { Order } from '../../../domain/entities/order.entity.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CrossTenantAccessError } from '../../../domain/errors/domain-errors.js';

export class OrderNotFoundError extends DomainError {
  constructor() {
    super('ORDER_NOT_FOUND', 'Order not found.');
  }
}

export class GetOrderUseCase {
  constructor(private readonly orderRepo: OrderRepository) {}

  async execute(id: string, tenantId: string): Promise<Result<Order, DomainError>> {
    const order = await this.orderRepo.findById(id);
    if (!order) return err(new OrderNotFoundError());
    if (order.tenantId !== tenantId) return err(new CrossTenantAccessError());
    return ok(order);
  }
}
