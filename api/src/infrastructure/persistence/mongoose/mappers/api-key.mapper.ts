import { ApiKey } from '../../../../domain/entities/api-key.entity.js';
import { normalizeScopes } from '../../../../domain/value-objects/api-scopes.js';
import { ApiKeyDocument } from '../schemas/api-key.schema.js';

export class ApiKeyMapper {
  static toDomain(doc: ApiKeyDocument): ApiKey {
    return new ApiKey(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.prefix,
      doc.keyHash,
      normalizeScopes(doc.scopes),
      doc.createdBy ? doc.createdBy.toHexString() : null,
      doc.lastUsedAt ?? null,
      doc.revokedAt ?? null,
      doc.createdAt,
    );
  }
}
