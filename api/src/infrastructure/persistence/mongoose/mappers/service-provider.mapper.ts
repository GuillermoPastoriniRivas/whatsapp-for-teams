import { ServiceProvider } from '../../../../domain/entities/service-provider.entity.js';
import { ServiceProviderDocument } from '../schemas/service-provider.schema.js';

export class ServiceProviderMapper {
  static toDomain(doc: ServiceProviderDocument): ServiceProvider {
    return new ServiceProvider(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.phone,
      doc.services ?? [],
      doc.active ?? false,
      doc.optInAt ?? null,
      doc.optInNote ?? '',
      doc.lastAssignedAt ?? null,
      doc.assignedCount ?? 0,
      doc.notes ?? '',
      doc.createdAt,
      doc.updatedAt,
    );
  }
}
