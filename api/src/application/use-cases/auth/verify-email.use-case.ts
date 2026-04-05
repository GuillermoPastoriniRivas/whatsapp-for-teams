import { createHash } from 'crypto';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PasswordResetTokenRepository } from '../../../domain/repositories/password-reset-token.repository.js';
import { Result, ok, err } from '../../common/result.js';
import { InvalidTokenError, TokenExpiredError } from '../../../domain/errors/domain-errors.js';

export class VerifyEmailUseCase {
  constructor(
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly agentRepo: AgentRepository,
  ) {}

  async execute(input: { token: string }): Promise<Result<void, InvalidTokenError | TokenExpiredError>> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const record = await this.resetTokenRepo.findByTokenHash(tokenHash);

    if (!record || record.type !== 'email_verification') return err(new InvalidTokenError());

    if (record.expiresAt < new Date()) {
      await this.resetTokenRepo.deleteByAgentId(record.agentId);
      return err(new TokenExpiredError());
    }

    await this.agentRepo.updateEmailVerified(record.agentId, true);
    await this.resetTokenRepo.deleteByAgentId(record.agentId);

    return ok(undefined);
  }
}
