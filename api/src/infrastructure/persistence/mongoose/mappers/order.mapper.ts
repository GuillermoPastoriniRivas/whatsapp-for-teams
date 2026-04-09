import { Order } from '../../../../domain/entities/order.entity.js';
import { OrderStatus } from '../../../../domain/enums/order-status.enum.js';
import { OrderDocument } from '../schemas/order.schema.js';

export class OrderMapper {
  static toDomain(doc: OrderDocument): Order {
    return new Order(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.conversationId.toHexString(),
      doc.contactId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.createdByAgentId,
      doc.status as OrderStatus,
      doc.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
      })),
      doc.deliveryType as 'delivery' | 'pickup',
      doc.deliveryAddress,
      doc.deliveryNotes,
      doc.estimatedTotal,
      doc.currency,
      doc.createdAt,
      doc.updatedAt,
      (doc as any).paymentMethod ?? null,
      (doc as any).customerName ?? null,
      (doc as any).customerPhone ?? null,
      (doc as any).deliveryCost ?? null,
      (doc as any).neighborhood ?? null,
    );
  }
}
