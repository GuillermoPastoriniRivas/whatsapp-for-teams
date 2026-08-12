import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { RateEntry } from '../../../../domain/entities/rate-card.entity.js';

export type RateCardDocument = HydratedDocument<RateCardModel>;

/**
 * Tabla de precios de Meta, versionada. Una card publicada no se edita: se
 * cierra con `effectiveTo` y se crea la siguiente.
 */
@Schema({ collection: 'rate_cards' })
export class RateCardModel {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  effectiveFrom: Date;

  @Prop({ type: Date, default: null })
  effectiveTo: Date | null;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ type: Array, default: [] })
  entries: RateEntry[];

  @Prop({ required: true, default: 'manual' })
  source: string;

  @Prop({ required: true })
  createdAt: Date;
}

export const RateCardSchema = SchemaFactory.createForClass(RateCardModel);

RateCardSchema.index({ effectiveFrom: -1 });
