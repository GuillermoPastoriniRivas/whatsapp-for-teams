import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { BusinessHours, BusinessProfile } from '../../../../domain/value-objects/business-profile.js';

export type TenantDocument = HydratedDocument<TenantModel>;

@Schema({ collection: 'tenants', timestamps: { createdAt: true, updatedAt: false } })
export class TenantModel {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ default: false })
  isDemo: boolean;

  /** Datos del negocio para los nodos de IA. Null en cuentas viejas. */
  @Prop({ type: Object, default: null })
  businessProfile: BusinessProfile | null;

  @Prop({ type: String, default: null })
  timezone: string | null;

  @Prop({ type: Object, default: null })
  businessHours: BusinessHours | null;

  /** Tope diario de gasto en IA de toda la cuenta. */
  @Prop({ type: Object, default: null })
  aiRateLimits: { maxMessagesPerDay: number; maxTokensPerDay: number } | null;

  createdAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(TenantModel);
