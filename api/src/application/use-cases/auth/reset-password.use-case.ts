import { createHash } from 'crypto';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PasswordResetTokenRepository } from '../../../domain/repositories/password-reset-token.repository.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import { ResetPasswordInput } from '../../dtos/auth/reset-password-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { InvalidTokenError, TokenExpiredError } from '../../../domain/errors/domain-errors.js';

export class ResetPasswordUseCase {
  constructor(
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly agentRepo: AgentRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: ResetPasswordInput): Promise<Result<void, InvalidTokenError | TokenExpiredError>> {
    // Hash the incoming token and look it up
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const record = await this.resetTokenRepo.findByTokenHash(tokenHash);

    if (!record) return err(new InvalidTokenError());

    // Check expiry
    if (record.expiresAt < new Date()) {
      await this.resetTokenRepo.deleteByAgentId(record.agentId);
      return err(new TokenExpiredError());
    }

    // Hash new password and update agent
    const passwordHash = await this.passwordHasher.hash(input.password);
    await this.agentRepo.updatePasswordHash(record.agentId, passwordHash);

    // Cleanup: delete all reset tokens and refresh tokens for this agent
    await this.resetTokenRepo.deleteByAgentId(record.agentId);
    await this.refreshTokenRepo.deleteByAgentId(record.agentId);

    return ok(undefined);
  }
}
