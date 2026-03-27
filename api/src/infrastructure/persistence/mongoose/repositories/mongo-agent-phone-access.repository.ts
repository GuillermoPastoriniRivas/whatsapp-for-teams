import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentPhoneAccessRepository } from '../../../../domain/repositories/agent-phone-access.repository.js';
import { AgentPhoneAccess } from '../../../../domain/entities/agent-phone-access.entity.js';
import { AgentPhoneAccessModel, AgentPhoneAccessDocument } from '../schemas/agent-phone-access.schema.js';
import { AgentPhoneAccessMapper } from '../mappers/agent-phone-access.mapper.js';

@Injectable()
export class MongoAgentPhoneAccessRepository implements AgentPhoneAccessRepository {
  constructor(
    @InjectModel(AgentPhoneAccessModel.name) private readonly model: Model<AgentPhoneAccessDocument>,
  ) {}

  async create(access: AgentPhoneAccess): Promise<AgentPhoneAccess> {
    const doc = await this.model.create({
      agentId: new Types.ObjectId(access.agentId),
      phoneNumberId: new Types.ObjectId(access.phoneNumberId),
    });
    return AgentPhoneAccessMapper.toDomain(doc);
  }

  async delete(agentId: string, phoneNumberId: string): Promise<boolean> {
    const result = await this.model.deleteOne({
      agentId: new Types.ObjectId(agentId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
    });
    return result.deletedCount > 0;
  }

  async findByAgentId(agentId: string): Promise<AgentPhoneAccess[]> {
    const docs = await this.model.find({ agentId: new Types.ObjectId(agentId) });
    return docs.map(AgentPhoneAccessMapper.toDomain);
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<AgentPhoneAccess[]> {
    const docs = await this.model.find({ phoneNumberId: new Types.ObjectId(phoneNumberId) });
    return docs.map(AgentPhoneAccessMapper.toDomain);
  }

  async exists(agentId: string, phoneNumberId: string): Promise<boolean> {
    const count = await this.model.countDocuments({
      agentId: new Types.ObjectId(agentId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
    });
    return count > 0;
  }
}
