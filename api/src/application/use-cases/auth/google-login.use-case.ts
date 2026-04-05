import { OAuth2Client } from 'google-auth-library';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { LoginOutput } from '../../dtos/auth/login-output.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { createHash, randomBytes } from 'crypto';

export class GoogleLoginUseCase {
  private readonly client: OAuth2Client;

  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly tokenProvider: TokenProviderPort,
    private readonly tenantRepo: TenantRepository,
    private readonly googleClientId: string,
  ) {
    this.client = new OAuth2Client(this.googleClientId);
  }

  async execute(input: { credential: string }): Promise<Result<LoginOutput, Error>> {
    // 1. Verify Google ID token
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: input.credential,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      return err(new Error('Invalid Google token'));
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return err(new Error('Google email not verified'));
    }

    const { email, name: googleName } = payload;
    const displayName = googleName ?? email.split('@')[0];

    // 2. Find or create agent
    let agent = await this.agentRepo.findByEmail(email);

    if (!agent) {
      // Create new tenant + admin agent
      const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
        + '-' + randomBytes(3).toString('hex');

      const tenant = await this.tenantRepo.create({ name: displayName, slug });

      agent = await this.agentRepo.create({
        tenantId: tenant.id,
        name: displayName,
        email,
        passwordHash: '',
        role: AgentRole.ADMIN,
        status: AgentStatus.AVAILABLE,
        activeCount: 0,
        type: AgentType.HUMAN,
        frozen: false,
        emailVerified: true,
      });
    }

    // 3. Issue tokens (same as demo-login)
    const tokenPayload = { sub: agent.id, tenantId: agent.tenantId, role: agent.role };

    const accessToken = this.tokenProvider.signAccess(tokenPayload);
    const refreshToken = this.tokenProvider.signRefresh(tokenPayload);

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
