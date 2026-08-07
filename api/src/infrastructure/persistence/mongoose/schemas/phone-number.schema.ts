import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessagingProvider } from '../../../../domain/enums/messaging-provider.enum.js';
import { PhoneNumberStatus } from '../../../../domain/enums/phone-number-status.enum.js';
import type { WhatsAppBusinessProfile } from '../../../../domain/entities/whatsapp-business-profile.entity.js';

export type PhoneNumberDocument = HydratedDocument<PhoneNumberModel>;

@Schema({ collection: 'phone_numbers', timestamps: { createdAt: true, updatedAt: false } })
export class PhoneNumberModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: MessagingProvider })
  provider: string;

  @Prop({ type: Object, required: true })
  providerConfig: Record<string, string>;

  @Prop({ required: true })
  wabaId: string;

  /**
   * Portfolio de negocio que scopea los BSUID de este número. Null hasta que se
   * configure: ahí se cae a `wabaId`.
   */
  @Prop({ type: String, default: null })
  portfolioId: string | null;

  @Prop({ required: true, unique: true })
  phoneNumberId: string;

  @Prop({ required: true })
  displayPhone: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  webhookSecret: string;

  @Prop({ required: true, enum: PhoneNumberStatus, default: PhoneNumberStatus.ACTIVE })
  status: string;

  /**
   * Copia del perfil de negocio del proveedor (about, dirección, rubro, foto).
   * Es caché para pintar la pantalla sin esperar a Meta; con el proveedor demo
   * pasa a ser la fuente, porque ahí no hay API atrás. `null` = nunca se leyó.
   */
  @Prop({ type: Object, default: null })
  businessProfile: WhatsAppBusinessProfile | null;

  createdAt: Date;
}

export const PhoneNumberSchema = SchemaFactory.createForClass(PhoneNumberModel);
