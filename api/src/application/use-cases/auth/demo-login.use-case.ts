import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { LoginOutput } from '../../dtos/auth/login-output.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { createHash } from 'crypto';

const DEMO_EMAIL = process.env.DEMO_AGENT_EMAIL ?? 'demo@asis.chat';

export class DemoLoginUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly tokenProvider: TokenProviderPort,
  ) {}

  async execute(): Promise<Result<LoginOutput, Error>> {
    const agent = await this.agentRepo.findByEmail(DEMO_EMAIL);
    if (!agent) return err(new Error('Demo not configured'));

    const payload = { sub: agent.id, tenantId: agent.tenantId, role: agent.role };

    const accessToken = this.tokenProvider.signAccess(payload);
    const refreshToken = this.tokenProvider.signRefresh(payload);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.create({ agentId: agent.id, tokenHash, expiresAt });

    return ok({
      accessToken,
      refreshToken,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role },
    });
  }
}
