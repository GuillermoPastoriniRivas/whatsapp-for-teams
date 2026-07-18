import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { Result, ok, err } from '../../common/result.js';
import { REFRESH_TOKEN_TTL_MS } from '../../common/auth-token-ttl.js';
import { InvalidCredentialsError } from '../../../domain/errors/domain-errors.js';
import { createHash } from 'crypto';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
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

    const newPayload = {
      sub: agent.id,
      tenantId: agent.tenantId,
      role: agent.role,
    };

    const accessToken = this.tokenProvider.signAccess(newPayload);

    // Rotación deslizante: cada uso emite un refresh token nuevo con TTL
    // completo. El anterior NO se borra (vence solo por TTL) para no romper
    // la sesión de otra pestaña/dispositivo que todavía lo tenga guardado.
    const refreshToken = this.tokenProvider.signRefresh(newPayload);
    const newTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.refreshTokenRepo.create({
      agentId: agent.id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return ok({ accessToken, refreshToken });
  }
}
