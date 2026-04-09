import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { OrderStatus } from '../../../domain/enums/order-status.enum.js';
import { Order } from '../../../domain/entities/order.entity.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CrossTenantAccessError } from '../../../domain/errors/domain-errors.js';
import { OrderNotFoundError } from './get-order.use-case.js';
import { NotifyOrderStatusUseCase } from './notify-order-status.use-case.js';

export class UpdateOrderStatusUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly notifyOrderStatus: NotifyOrderStatusUseCase,
  ) {}

  async execute(id: string, status: OrderStatus, tenantId: string): Promise<Result<Order, DomainError>> {
    const existing = await this.orderRepo.findById(id);
    if (!existing) return err(new OrderNotFoundError());
    if (existing.tenantId !== tenantId) return err(new CrossTenantAccessError());

    const updated = await this.orderRepo.updateStatus(id, status);
    if (!updated) return err(new OrderNotFoundError());

    this.gateway.emitToTenant(tenantId, 'order.updated', updated);

    // Fire-and-forget: notify customer via WhatsApp if applicable
    this.notifyOrderStatus.execute(updated).catch(() => {});

    return ok(updated);
  }
}
