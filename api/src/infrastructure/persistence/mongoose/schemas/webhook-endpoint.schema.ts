import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WebhookEndpointDocument = HydratedDocument<WebhookEndpointModel>;

@Schema({ collection: 'webhook_endpoints', timestamps: { createdAt: true, updatedAt: false } })
export class WebhookEndpointModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ required: true })
  secret: string;

  @Prop({ type: [String], required: true, default: [] })
  events: string[];

  @Prop({ default: true })
  active: boolean;

  createdAt: Date;
}

export const WebhookEndpointSchema = SchemaFactory.createForClass(WebhookEndpointModel);

WebhookEndpointSchema.index({ tenantId: 1 });
WebhookEndpointSchema.index({ tenantId: 1, active: 1, events: 1 });
