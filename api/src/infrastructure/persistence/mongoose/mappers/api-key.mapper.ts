import { ApiKey } from '../../../../domain/entities/api-key.entity.js';
import { ApiKeyDocument } from '../schemas/api-key.schema.js';

export class ApiKeyMapper {
  static toDomain(doc: ApiKeyDocument): ApiKey {
    return new ApiKey(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.prefix,
      doc.keyHash,
      doc.createdBy ? doc.createdBy.toHexString() : null,
      doc.lastUsedAt ?? null,
      doc.revokedAt ?? null,
      doc.createdAt,
    );
  }
}
