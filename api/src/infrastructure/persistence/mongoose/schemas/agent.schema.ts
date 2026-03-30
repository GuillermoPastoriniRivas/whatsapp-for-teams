import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AgentRole } from '../../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../../domain/enums/agent-type.enum.js';

export type AgentDocument = HydratedDocument<AgentModel>;

@Schema({ collection: 'agents', timestamps: { createdAt: true, updatedAt: false } })
export class AgentModel {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: false, default: '' })
  passwordHash: string;

  @Prop({ required: true, enum: AgentRole, default: AgentRole.AGENT })
  role: string;

  @Prop({ required: true, enum: AgentStatus, default: AgentStatus.AVAILABLE })
  status: string;

  @Prop({ required: true, default: 0 })
  activeCount: number;

  @Prop({ required: true, enum: AgentType, default: AgentType.HUMAN })
  type: string;

  createdAt: Date;
}

export const AgentSchema = SchemaFactory.createForClass(AgentModel);
