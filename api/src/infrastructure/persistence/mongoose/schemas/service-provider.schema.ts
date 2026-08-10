import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceProviderDocument = HydratedDocument<ServiceProviderModel>;

@Schema({ collection: 'service_providers', timestamps: true })
export class ServiceProviderModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  /** Dígitos E.164 sin '+'. */
  @Prop({ required: true })
  phone: string;

  @Prop({ type: [String], default: [] })
  services: string[];

  @Prop({ required: true, default: false })
  active: boolean;

  @Prop({ type: Date, default: null })
  optInAt: Date | null;

  @Prop({ default: '' })
  optInNote: string;

  @Prop({ type: Date, default: null })
  lastAssignedAt: Date | null;

  @Prop({ required: true, default: 0 })
  assignedCount: number;

  @Prop({ default: '' })
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceProviderSchema = SchemaFactory.createForClass(ServiceProviderModel);

ServiceProviderSchema.index({ tenantId: 1, name: 1 });
// El índice del reparto: se busca por tenant + servicio + activo y se ordena por
// quién hace más tiempo que no recibe.
ServiceProviderSchema.index({ tenantId: 1, services: 1, active: 1, lastAssignedAt: 1 });
// Un proveedor por número dentro de la cuenta: dos fichas del mismo carpintero
// le mandarían el dato dos veces y romperían el reparto parejo.
ServiceProviderSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
