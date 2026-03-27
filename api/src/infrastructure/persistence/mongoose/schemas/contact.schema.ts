import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContactDocument = HydratedDocument<ContactModel>;

@Schema({ collection: 'contacts', timestamps: { createdAt: true, updatedAt: false } })
export class ContactModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  waId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ default: null })
  profilePicUrl: string | null;

  @Prop({ required: true, default: () => new Date() })
  lastSeenAt: Date;

  createdAt: Date;
}

export const ContactSchema = SchemaFactory.createForClass(ContactModel);

ContactSchema.index({ tenantId: 1, waId: 1 }, { unique: true });
