import { Tenant } from '../../../../domain/entities/tenant.entity.js';
import { TenantDocument } from '../schemas/tenant.schema.js';

export class TenantMapper {
  static toDomain(doc: TenantDocument): Tenant {
    return new Tenant(
      doc._id.toHexString(),
      doc.name,
      doc.slug,
      doc.createdAt,
    );
  }
}
