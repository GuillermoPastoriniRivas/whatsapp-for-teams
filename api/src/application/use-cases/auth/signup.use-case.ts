import { randomBytes, createHash } from 'crypto';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { PasswordResetTokenRepository } from '../../../domain/repositories/password-reset-token.repository.js';
import { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import { TokenProviderPort } from '../../ports/token-provider.port.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { LoginOutput } from '../../dtos/auth/login-output.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { EmailAlreadyExistsError } from '../../../domain/errors/domain-errors.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { emailVerificationEmail } from '../../../infrastructure/email/templates/email-verification.template.js';

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export class SignupUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenProvider: TokenProviderPort,
    private readonly jobQueue: JobQueuePort,
    private readonly frontendUrl: string,
    private readonly fromEmail: string,
  ) {}

  async execute(input: SignupInput): Promise<Result<LoginOutput, EmailAlreadyExistsError>> {
    // 1. Check for existing email
    const existing = await this.agentRepo.findByEmail(input.email);
    if (existing) return err(new EmailAlreadyExistsError());

    // 2. Generate tenant slug
    const emailPrefix = input.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const slug = emailPrefix + '-' + randomBytes(3).toString('hex');

    // 3. Create tenant and agent
    const tenant = await this.tenantRepo.create({ name: input.name, slug });

    const passwordHash = await this.passwordHasher.hash(input.password);

    const agent = await this.agentRepo.create({
      tenantId: tenant.id,
      name: input.name,
      email: input.email,
      passwordHash,
      role: AgentRole.ADMIN,
      status: AgentStatus.AVAILABLE,
      activeCount: 0,
      type: AgentType.HUMAN,
      frozen: false,
      emailVerified: false,
      requiresOnboarding: true,
    });

    // 4. Generate email verification token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.resetTokenRepo.create({
      agentId: agent.id,
      tokenHash,
      type: 'email_verification',
      expiresAt,
    });

    // 5. Enqueue verification email
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${rawToken}`;
    const emailContent = emailVerificationEmail({
      agentName: agent.name,
      verifyUrl,
      expiresInHours: VERIFICATION_TOKEN_EXPIRY_HOURS,
    });

    await this.jobQueue.enqueue('email.send', {
      to: { email: agent.email, name: agent.name },
      from: this.fromEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    // 6. Issue JWT tokens (user is logged in immediately)
    const tokenPayload = { sub: agent.id, tenantId: agent.tenantId, role: agent.role };
    const accessToken = this.tokenProvider.signAccess(tokenPayload);
    const refreshToken = this.tokenProvider.signRefresh(tokenPayload);

    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.create({ agentId: agent.id, tokenHash: refreshTokenHash, expiresAt: refreshExpiresAt });

    return ok({
      accessToken,
      refreshToken,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, requiresOnboarding: agent.requiresOnboarding },
    });
  }
}
