import { OrderRepository, OrderFilters, PaginatedOrders } from '../../../domain/repositories/order.repository.js';

export class ListOrdersUseCase {
  constructor(private readonly orderRepo: OrderRepository) {}

  async execute(filters: OrderFilters): Promise<PaginatedOrders> {
    return this.orderRepo.findByFilters(filters);
  }
}
