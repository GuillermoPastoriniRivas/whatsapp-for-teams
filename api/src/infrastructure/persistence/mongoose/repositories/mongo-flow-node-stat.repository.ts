import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FlowNodeStatRepository } from '../../../../domain/repositories/flow-node-stat.repository.js';
import { FlowNodeStat } from '../../../../domain/entities/flow-node-stat.entity.js';
import { FlowNodeStatModel, FlowNodeStatDocument } from '../schemas/flow-node-stat.schema.js';
import { FlowNodeStatMapper } from '../mappers/flow-node-stat.mapper.js';

@Injectable()
export class MongoFlowNodeStatRepository implements FlowNodeStatRepository {
  constructor(
    @InjectModel(FlowNodeStatModel.name) private readonly model: Model<FlowNodeStatDocument>,
  ) {}

  async increment(
    tenantId: string,
    flowId: string,
    flowVersionId: string,
    nodeId: string,
    date: string,
    delta: { entered?: number; errors?: number; outcomeHandle?: string },
  ): Promise<void> {
    const inc: Record<string, number> = {};
    if (delta.entered) inc.entered = delta.entered;
    if (delta.errors) inc.errors = delta.errors;
    if (delta.outcomeHandle) inc[`outcomes.${delta.outcomeHandle}`] = 1;
    if (Object.keys(inc).length === 0) return;

    await this.model.updateOne(
      { flowVersionId: new Types.ObjectId(flowVersionId), nodeId, date },
      {
        $inc: inc,
        $setOnInsert: {
          tenantId: new Types.ObjectId(tenantId),
          flowId: new Types.ObjectId(flowId),
        },
      },
      { upsert: true },
    );
  }

  async findByFlowId(flowId: string, fromDate: string): Promise<FlowNodeStat[]> {
    const docs = await this.model.find({
      flowId: new Types.ObjectId(flowId),
      date: { $gte: fromDate },
    });
    return docs.map(FlowNodeStatMapper.toDomain);
  }
}
