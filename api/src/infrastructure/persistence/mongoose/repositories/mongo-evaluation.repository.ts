import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { EvaluationRepository } from '../../../../domain/repositories/evaluation.repository.js';
import { EvaluationCase, EvaluationRun } from '../../../../domain/entities/evaluation.entity.js';
import {
  EvaluationCaseModel,
  EvaluationRunModel,
  type EvaluationCaseDocument,
  type EvaluationRunDocument,
} from '../schemas/evaluation.schema.js';

@Injectable()
export class MongoEvaluationRepository implements EvaluationRepository {
  constructor(
    @InjectModel(EvaluationCaseModel.name) private readonly cases: Model<EvaluationCaseDocument>,
    @InjectModel(EvaluationRunModel.name) private readonly runs: Model<EvaluationRunDocument>,
  ) {}

  private toCase(doc: EvaluationCaseDocument): EvaluationCase {
    return new EvaluationCase(
      doc._id.toString(),
      doc.tenantId.toString(),
      doc.question,
      doc.expectation ?? '',
      doc.expectHandoff ?? false,
      doc.createdAt,
    );
  }

  private toRun(doc: EvaluationRunDocument): EvaluationRun {
    return new EvaluationRun(doc._id.toString(), doc.tenantId.toString(), doc.summary, doc.verdicts, doc.createdAt);
  }

  async createCase(input: Omit<EvaluationCase, 'id' | 'createdAt'>): Promise<EvaluationCase> {
    const created = await this.cases.create({
      tenantId: new Types.ObjectId(input.tenantId),
      question: input.question,
      expectation: input.expectation,
      expectHandoff: input.expectHandoff,
    });
    return this.toCase(created);
  }

  async findCasesByTenantId(tenantId: string): Promise<EvaluationCase[]> {
    const found = await this.cases.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ createdAt: 1 });
    return found.map((doc) => this.toCase(doc));
  }

  async findCaseById(id: string): Promise<EvaluationCase | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const found = await this.cases.findById(id);
    return found ? this.toCase(found) : null;
  }

  async deleteCase(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await this.cases.deleteOne({ _id: new Types.ObjectId(id) });
  }

  async createRun(input: Omit<EvaluationRun, 'id' | 'createdAt'>): Promise<EvaluationRun> {
    const created = await this.runs.create({
      tenantId: new Types.ObjectId(input.tenantId),
      summary: input.summary,
      verdicts: input.verdicts,
    });
    return this.toRun(created);
  }

  async findLastRun(tenantId: string): Promise<EvaluationRun | null> {
    const found = await this.runs.findOne({ tenantId: new Types.ObjectId(tenantId) }).sort({ createdAt: -1 });
    return found ? this.toRun(found) : null;
  }
}
