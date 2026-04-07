import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderStatus } from '../../../../domain/enums/order-status.enum.js';

export type OrderDocument = HydratedDocument<OrderModel>;

@Schema({ _id: false })
class OrderItemModel {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  unitPrice?: number;

  @Prop()
  notes?: string;
}

@Schema({ collection: 'orders', timestamps: true })
export class OrderModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  contactId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ type: String, default: null })
  createdByAgentId: string | null;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING })
  status: string;

  @Prop({ type: [OrderItemModel], required: true, default: [] })
  items: OrderItemModel[];

  @Prop({ required: true, enum: ['delivery', 'pickup'] })
  deliveryType: string;

  @Prop({ type: String, default: null })
  deliveryAddress: string | null;

  @Prop({ type: String, default: null })
  deliveryNotes: string | null;

  @Prop({ type: Number, default: null })
  estimatedTotal: number | null;

  @Prop({ type: String, default: null })
  currency: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(OrderModel);

OrderSchema.index({ tenantId: 1, createdAt: -1 });
OrderSchema.index({ conversationId: 1 });
OrderSchema.index({ tenantId: 1, status: 1 });
