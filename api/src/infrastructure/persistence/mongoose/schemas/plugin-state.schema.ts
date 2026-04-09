import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PluginStateDocument = HydratedDocument<PluginStateModel>;

@Schema({ collection: 'plugin_states', timestamps: true })
export class PluginStateModel {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true })
  pluginId: string;

  @Prop({ type: Object, required: true })
  state: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const PluginStateSchema = SchemaFactory.createForClass(PluginStateModel);

PluginStateSchema.index({ conversationId: 1, pluginId: 1 }, { unique: true });
