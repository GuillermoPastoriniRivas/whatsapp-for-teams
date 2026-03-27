import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { Result, ok, err } from '../../common/result.js';
import { InvalidCredentialsError } from '../../../domain/errors/domain-errors.js';
import { createHash } from 'crypto';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly agentRepo: AgentRepository,
    private readonly tokenProvider: TokenProviderPort,
  ) {}

  async execute(input: RefreshTokenInput): Promise<Result<RefreshTokenOutput, InvalidCredentialsError>> {
    let payload;
    try {
      payload = this.tokenProvider.verifyRefresh(input.refreshToken);
    } catch {
      return err(new InvalidCredentialsError());
    }

    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');
    const stored = await this.refreshTokenRepo.findByTokenHash(tokenHash);
    if (!stored || stored.expiresAt < new Date()) {
      return err(new InvalidCredentialsError());
    }

    const agent = await this.agentRepo.findById(payload.sub);
    if (!agent) return err(new InvalidCredentialsError());

    const accessToken = this.tokenProvider.signAccess({
      sub: agent.id,
      tenantId: agent.tenantId,
      role: agent.role,
    });

    return ok({ accessToken });
  }
}
