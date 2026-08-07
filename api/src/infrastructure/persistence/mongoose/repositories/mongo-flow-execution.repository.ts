import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import {
  CreateFlowExecutionInput,
  FlowExecutionCasPatch,
  FlowExecutionRepository,
} from '../../../../domain/repositories/flow-execution.repository.js';
import { FlowExecution, FlowStepLog } from '../../../../domain/entities/flow-execution.entity.js';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';
import { PaginatedResult } from '../../../../domain/repositories/conversation.repository.js';
import { FlowExecutionModel, FlowExecutionDocument } from '../schemas/flow-execution.schema.js';
import { FlowExecutionMapper } from '../mappers/flow-execution.mapper.js';

const ACTIVE_STATUSES = [FlowExecutionStatus.RUNNING, FlowExecutionStatus.WAITING];
const STEP_LOG_CAP = 200;

@Injectable()
export class MongoFlowExecutionRepository implements FlowExecutionRepository {
  constructor(
    @InjectModel(FlowExecutionModel.name) private readonly model: Model<FlowExecutionDocument>,
  ) {}

  async tryCreateActive(input: CreateFlowExecutionInput): Promise<FlowExecution | null> {
    try {
      const doc = await this.model.create({
        ...input,
        tenantId: new Types.ObjectId(input.tenantId),
        flowId: new Types.ObjectId(input.flowId),
        flowVersionId: new Types.ObjectId(input.flowVersionId),
        conversationId: new Types.ObjectId(input.conversationId),
        contactId: new Types.ObjectId(input.contactId),
        phoneNumberId: new Types.ObjectId(input.phoneNumberId),
      });
      return FlowExecutionMapper.toDomain(doc);
    } catch (error: any) {
      // E11000: otra ejecución viva ganó la carrera por esta conversación.
      if (error?.code === 11000) return null;
      throw error;
    }
  }

  async findById(id: string): Promise<FlowExecution | null> {
    const doc = await this.model.findById(new Types.ObjectId(id));
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  async findActiveByConversationId(conversationId: string): Promise<FlowExecution | null> {
    const doc = await this.model.findOne({
      conversationId: new Types.ObjectId(conversationId),
      status: { $in: ACTIVE_STATUSES },
    });
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  async casClaim(
    id: string,
    from: FlowExecutionStatus,
    token: string,
    patch: FlowExecutionCasPatch,
  ): Promise<FlowExecution | null> {
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: from, resumeToken: token },
      { $set: { ...patch } },
      { returnDocument: 'after' },
    );
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  async advanceCursor(
    id: string,
    token: string,
    patch: FlowExecutionCasPatch,
    step: FlowStepLog,
  ): Promise<FlowExecution | null> {
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: FlowExecutionStatus.RUNNING, resumeToken: token },
      {
        $set: { ...patch },
        $push: { steps: { $each: [step], $slice: -STEP_LOG_CAP } },
        $inc: { stepCount: 1 },
      },
      { returnDocument: 'after' },
    );
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  async cancelActiveByConversation(conversationId: string, endReason: string): Promise<FlowExecution | null> {
    const doc = await this.model.findOneAndUpdate(
      { conversationId: new Types.ObjectId(conversationId), status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: FlowExecutionStatus.CANCELLED,
          endReason,
          waitState: null,
          runningSince: null,
          endedAt: new Date(),
          // Rotar el token cerca a cualquier worker/job zombie.
          resumeToken: randomBytes(16).toString('hex'),
        },
      },
      { returnDocument: 'after' },
    );
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  /**
   * Congela la ejecución viva conservando su punto (currentNodeId, waitState,
   * variables). El token rota, así que cualquier job en vuelo — un delay que
   * está por vencer, un resume encolado — queda como no-op al llegar.
   */
  async pauseActiveByConversation(conversationId: string, reason: string): Promise<FlowExecution | null> {
    const doc = await this.model.findOneAndUpdate(
      { conversationId: new Types.ObjectId(conversationId), status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: FlowExecutionStatus.PAUSED,
          endReason: reason,
          runningSince: null,
          resumeToken: randomBytes(16).toString('hex'),
        },
      },
      { returnDocument: 'after' },
    );
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  /**
   * Devuelve la ejecución a la vida. Vuelve siempre a WAITING cuando quedó
   * esperando algo y a RUNNING si la pausamos a mitad de un paso; el caller
   * decide qué job reencolar mirando el waitState.
   */
  async resumePausedByConversation(conversationId: string): Promise<FlowExecution | null> {
    const paused = await this.model.findOne({
      conversationId: new Types.ObjectId(conversationId),
      status: FlowExecutionStatus.PAUSED,
    });
    if (!paused) return null;

    const doc = await this.model.findOneAndUpdate(
      { _id: paused._id, status: FlowExecutionStatus.PAUSED },
      {
        $set: {
          status: paused.waitState ? FlowExecutionStatus.WAITING : FlowExecutionStatus.RUNNING,
          endReason: null,
          runningSince: paused.waitState ? null : new Date(),
          resumeToken: randomBytes(16).toString('hex'),
        },
      },
      { returnDocument: 'after' },
    );
    return doc ? FlowExecutionMapper.toDomain(doc) : null;
  }

  async cancelActiveByFlowId(flowId: string, endReason: string): Promise<number> {
    const result = await this.model.updateMany(
      { flowId: new Types.ObjectId(flowId), status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: FlowExecutionStatus.CANCELLED,
          endReason,
          waitState: null,
          runningSince: null,
          endedAt: new Date(),
          resumeToken: randomBytes(16).toString('hex'),
        },
      },
    );
    return result.modifiedCount;
  }

  async findStaleRunning(before: Date): Promise<FlowExecution[]> {
    const docs = await this.model
      .find({ status: FlowExecutionStatus.RUNNING, runningSince: { $ne: null, $lt: before } })
      .limit(100);
    return docs.map(FlowExecutionMapper.toDomain);
  }

  async findExpiredWaiting(before: Date): Promise<FlowExecution[]> {
    const docs = await this.model
      .find({ status: FlowExecutionStatus.WAITING, 'waitState.timeoutAt': { $lt: before } })
      .limit(100);
    return docs.map(FlowExecutionMapper.toDomain);
  }

  async findByFlowId(
    flowId: string,
    page: number,
    limit: number,
    status?: FlowExecutionStatus,
  ): Promise<PaginatedResult<FlowExecution>> {
    const filter: Record<string, unknown> = { flowId: new Types.ObjectId(flowId) };
    if (status) filter.status = status;

    const [docs, total] = await Promise.all([
      this.model.find(filter).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit),
      this.model.countDocuments(filter),
    ]);

    return {
      data: docs.map(FlowExecutionMapper.toDomain),
      meta: { total, page, pages: Math.ceil(total / limit) },
    };
  }

  async countStartedSince(conversationId: string, since: Date): Promise<number> {
    return this.model.countDocuments({
      conversationId: new Types.ObjectId(conversationId),
      startedAt: { $gte: since },
    });
  }
}
