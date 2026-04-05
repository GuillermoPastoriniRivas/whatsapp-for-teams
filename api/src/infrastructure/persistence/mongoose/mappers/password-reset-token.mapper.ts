import { PasswordResetToken } from '../../../../domain/entities/password-reset-token.entity.js';
import type { PasswordResetTokenType } from '../../../../domain/entities/password-reset-token.entity.js';
import { PasswordResetTokenDocument } from '../schemas/password-reset-token.schema.js';

export class PasswordResetTokenMapper {
  static toDomain(doc: PasswordResetTokenDocument): PasswordResetToken {
    return new PasswordResetToken(
      doc._id.toHexString(),
      doc.agentId.toHexString(),
      doc.tokenHash,
      doc.type as PasswordResetTokenType,
      doc.expiresAt,
      doc.createdAt,
    );
  }
}
