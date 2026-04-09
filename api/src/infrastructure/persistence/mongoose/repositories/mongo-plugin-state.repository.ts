import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PluginStateRepository } from '../../../../domain/repositories/plugin-state.repository.js';
import { PluginStateModel, PluginStateDocument } from '../schemas/plugin-state.schema.js';

@Injectable()
export class MongoPluginStateRepository implements PluginStateRepository {
  constructor(
    @InjectModel(PluginStateModel.name) private readonly model: Model<PluginStateDocument>,
  ) {}

  async getState<T>(conversationId: string, pluginId: string): Promise<T | null> {
    const doc = await this.model.findOne({
      conversationId: new Types.ObjectId(conversationId),
      pluginId,
    });
    return doc ? (doc.state as unknown as T) : null;
  }

  async setState<T>(conversationId: string, pluginId: string, state: T): Promise<void> {
    await this.model.findOneAndUpdate(
      {
        conversationId: new Types.ObjectId(conversationId),
        pluginId,
      },
      {
        $set: { state },
        $setOnInsert: {
          conversationId: new Types.ObjectId(conversationId),
          pluginId,
        },
      },
      { upsert: true },
    );
  }

  async clearState(conversationId: string, pluginId: string): Promise<void> {
    await this.model.deleteOne({
      conversationId: new Types.ObjectId(conversationId),
      pluginId,
    });
  }

  async clearAllForConversation(conversationId: string): Promise<void> {
    await this.model.deleteMany({
      conversationId: new Types.ObjectId(conversationId),
    });
  }
}
