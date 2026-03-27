import { RefreshToken } from '../../../../domain/entities/refresh-token.entity.js';
import { RefreshTokenDocument } from '../schemas/refresh-token.schema.js';

export class RefreshTokenMapper {
  static toDomain(doc: RefreshTokenDocument): RefreshToken {
    return new RefreshToken(
      doc._id.toHexString(),
      doc.agentId.toHexString(),
      doc.tokenHash,
      doc.expiresAt,
      doc.createdAt,
    );
  }
}
