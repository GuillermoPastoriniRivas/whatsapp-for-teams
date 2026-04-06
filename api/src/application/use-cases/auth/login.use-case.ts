import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { LoginInput } from '../../dtos/auth/login-input.dto.js';
import { LoginOutput } from '../../dtos/auth/login-output.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { InvalidCredentialsError } from '../../../domain/errors/domain-errors.js';
import { createHash } from 'crypto';

export class LoginUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenProvider: TokenProviderPort,
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginOutput, InvalidCredentialsError>> {
    const agent = await this.agentRepo.findByEmail(input.email);
    if (!agent) return err(new InvalidCredentialsError());

    const valid = await this.passwordHasher.verify(input.password, agent.passwordHash);
    if (!valid) return err(new InvalidCredentialsError());

    const payload = { sub: agent.id, tenantId: agent.tenantId, role: agent.role };

    const accessToken = this.tokenProvider.signAccess(payload);
    const refreshToken = this.tokenProvider.signRefresh(payload);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.refreshTokenRepo.create({ agentId: agent.id, tokenHash, expiresAt });

    return ok({
      accessToken,
      refreshToken,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, requiresOnboarding: agent.requiresOnboarding },
    });
  }
}
