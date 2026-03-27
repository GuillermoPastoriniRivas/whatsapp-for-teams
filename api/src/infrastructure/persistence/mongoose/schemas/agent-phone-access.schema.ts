import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AgentPhoneAccessDocument = HydratedDocument<AgentPhoneAccessModel>;

@Schema({ collection: 'agent_phone_access' })
export class AgentPhoneAccessModel {
  @Prop({ type: Types.ObjectId, required: true })
  agentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  phoneNumberId: Types.ObjectId;
}

export const AgentPhoneAccessSchema = SchemaFactory.createForClass(AgentPhoneAccessModel);

AgentPhoneAccessSchema.index({ agentId: 1, phoneNumberId: 1 }, { unique: true });
AgentPhoneAccessSchema.index({ phoneNumberId: 1 });
