import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { ConversationStatus } from '../../../../domain/enums/conversation-status.enum.js';
import { OrderFlowState } from '../../../../domain/enums/order-flow-state.enum.js';
import type { OrderFlowData } from '../../../../domain/value-objects/order-flow.types.js';
import { ConversationDocument } from '../schemas/conversation.schema.js';

export class ConversationMapper {
  static toDomain(doc: ConversationDocument): Conversation {
    let orderFlow: OrderFlowData | null = null;
    if (doc.orderFlow) {
      orderFlow = {
        state: doc.orderFlow.state as OrderFlowState,
        items: doc.orderFlow.items ?? [],
        deliveryType: doc.orderFlow.deliveryType as 'delivery' | 'pickup' | null,
        deliveryAddress: doc.orderFlow.deliveryAddress ?? null,
        deliveryNotes: doc.orderFlow.deliveryNotes ?? null,
        estimatedTotal: doc.orderFlow.estimatedTotal ?? null,
        currency: doc.orderFlow.currency ?? null,
        paymentMethod: (doc.orderFlow as any).paymentMethod ?? null,
        customerName: (doc.orderFlow as any).customerName ?? null,
        customerPhone: (doc.orderFlow as any).customerPhone ?? null,
        neighborhood: (doc.orderFlow as any).neighborhood ?? null,
        deliveryCost: (doc.orderFlow as any).deliveryCost ?? null,
        source: (doc.orderFlow as any).source ?? null,
        updatedAt: doc.orderFlow.updatedAt ?? new Date(),
      };
    }

    return new Conversation(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.phoneNumberId.toHexString(),
      doc.contactId.toHexString(),
      doc.agentId?.toHexString() ?? null,
      doc.status as ConversationStatus,
      doc.lastMessageAt,
      doc.lastInboundAt,
      doc.createdAt,
      doc.resolvedAt,
      doc.closedBy,
      doc.summary ?? null,
      orderFlow,
    );
  }
}
