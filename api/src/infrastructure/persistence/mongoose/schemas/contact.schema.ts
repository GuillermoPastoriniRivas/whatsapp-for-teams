import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContactDocument = HydratedDocument<ContactModel>;

@Schema({ collection: 'contacts', timestamps: { createdAt: true, updatedAt: false } })
export class ContactModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  /** Dígitos E.164 sin '+'. Null si el usuario solo compartió su username. */
  @Prop({ type: String, default: null })
  phone: string | null;

  /** BSUID: `CC.alfanumérico`. Solo tiene sentido junto a `portfolioId`. */
  @Prop({ type: String, default: null })
  bsuid: string | null;

  @Prop({ type: String, default: null })
  parentBsuid: string | null;

  /** Username público, guardado sin '@'. */
  @Prop({ type: String, default: null })
  username: string | null;

  /** Portfolio de negocio bajo el que Meta emitió el BSUID. */
  @Prop({ type: String, default: null })
  portfolioId: string | null;

  @Prop({ type: String, default: null })
  profilePicUrl: string | null;

  @Prop({ required: true, default: () => new Date() })
  lastSeenAt: Date;

  @Prop({ type: String, default: null })
  email: string | null;

  @Prop({ type: String, default: null })
  company: string | null;

  @Prop({ type: String, default: null })
  notes: string | null;

  @Prop({ type: Object, default: {} })
  customFields: Record<string, string>;

  createdAt: Date;
}

export const ContactSchema = SchemaFactory.createForClass(ContactModel);

// Índices *parciales*, no sparse: un compuesto sparse solo ignora el documento
// cuando faltan todos los campos indexados, y `tenantId` siempre está presente.
// Con sparse, todos los contactos sin teléfono colisionarían entre sí.
ContactSchema.index(
  { tenantId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
);
ContactSchema.index(
  { tenantId: 1, portfolioId: 1, bsuid: 1 },
  { unique: true, partialFilterExpression: { bsuid: { $type: 'string' } } },
);
ContactSchema.index({ tenantId: 1, lastSeenAt: -1 });
