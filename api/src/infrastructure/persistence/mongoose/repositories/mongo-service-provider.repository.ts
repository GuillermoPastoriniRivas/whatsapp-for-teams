import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateServiceProviderInput,
  ServiceProviderRepository,
  UpdateServiceProviderInput,
} from '../../../../domain/repositories/service-provider.repository.js';
import { ServiceProvider } from '../../../../domain/entities/service-provider.entity.js';
import { ServiceProviderModel, ServiceProviderDocument } from '../schemas/service-provider.schema.js';
import { ServiceProviderMapper } from '../mappers/service-provider.mapper.js';

@Injectable()
export class MongoServiceProviderRepository implements ServiceProviderRepository {
  constructor(
    @InjectModel(ServiceProviderModel.name) private readonly model: Model<ServiceProviderDocument>,
  ) {}

  async create(input: CreateServiceProviderInput): Promise<ServiceProvider> {
    const doc = await this.model.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
    });
    return ServiceProviderMapper.toDomain(doc);
  }

  async findById(id: string): Promise<ServiceProvider | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(new Types.ObjectId(id));
    return doc ? ServiceProviderMapper.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<ServiceProvider[]> {
    const docs = await this.model.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ name: 1 });
    return docs.map(ServiceProviderMapper.toDomain);
  }

  async findByTenantAndPhone(tenantId: string, phone: string): Promise<ServiceProvider | null> {
    const doc = await this.model.findOne({ tenantId: new Types.ObjectId(tenantId), phone });
    return doc ? ServiceProviderMapper.toDomain(doc) : null;
  }

  async update(id: string, patch: UpdateServiceProviderInput): Promise<ServiceProvider | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' });
    return doc ? ServiceProviderMapper.toDomain(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const result = await this.model.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount > 0;
  }

  async claimNextForService(tenantId: string, service: string): Promise<ServiceProvider | null> {
    // Buscar-y-estampar en una sola operación: con dos clientes eligiendo el
    // mismo servicio a la vez, leer y después escribir le daría los dos al
    // mismo proveedor. `sort` + `findOneAndUpdate` lo resuelve atómicamente.
    //
    // `optInAt: { $ne: null }` es cinturón y tirantes: el ABM ya impide activar
    // sin opt-in, pero un dato viejo o tocado a mano no puede colarse acá.
    const doc = await this.model.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        services: service,
        active: true,
        optInAt: { $ne: null },
      },
      { $set: { lastAssignedAt: new Date() }, $inc: { assignedCount: 1 } },
      // null primero: quien nunca recibió tiene prioridad sobre quien recibió
      // hace mucho, que es lo que hace parejo el reparto desde el arranque.
      { sort: { lastAssignedAt: 1 }, returnDocument: 'after' },
    );
    return doc ? ServiceProviderMapper.toDomain(doc) : null;
  }
}
