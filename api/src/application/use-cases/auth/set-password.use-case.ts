import { createHash } from 'crypto';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PasswordResetTokenRepository } from '../../../domain/repositories/password-reset-token.repository.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { SetPasswordInput } from '../../dtos/auth/set-password-input.dto.js';
import { LoginOutput } from '../../dtos/auth/login-output.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { REFRESH_TOKEN_TTL_MS } from '../../common/auth-token-ttl.js';
import { AgentNotFoundError, InvalidCredentialsError } from '../../../domain/errors/domain-errors.js';

export class SetPasswordUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenProvider: TokenProviderPort,
  ) {}

  async execute(input: SetPasswordInput): Promise<Result<LoginOutput, AgentNotFoundError | InvalidCredentialsError>> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) return err(new AgentNotFoundError());

    // Google-created accounts have an empty hash: they set a password for the
    // first time and have no current password to prove.
    if (agent.passwordHash !== '') {
      if (!input.currentPassword) return err(new InvalidCredentialsError());
      const valid = await this.passwordHasher.verify(input.currentPassword, agent.passwordHash);
      if (!valid) return err(new InvalidCredentialsError());
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    await this.agentRepo.updatePasswordHash(agent.id, passwordHash);

    // Any pending reset link is now stale, and every other session must die
    await this.resetTokenRepo.deleteByAgentId(agent.id);
    await this.refreshTokenRepo.deleteByAgentId(agent.id);

    // Re-issue tokens so the caller's own session survives the revocation
    const payload = { sub: agent.id, tenantId: agent.tenantId, role: agent.role };

    const accessToken = this.tokenProvider.signAccess(payload);
    const refreshToken = this.tokenProvider.signRefresh(payload);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.refreshTokenRepo.create({ agentId: agent.id, tokenHash, expiresAt });

    return ok({
      accessToken,
      refreshToken,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, requiresOnboarding: agent.requiresOnboarding },
    });
  }
}
