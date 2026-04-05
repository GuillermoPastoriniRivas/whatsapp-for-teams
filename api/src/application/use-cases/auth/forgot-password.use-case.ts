import { randomBytes, createHash } from 'crypto';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PasswordResetTokenRepository } from '../../../domain/repositories/password-reset-token.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { ForgotPasswordInput } from '../../dtos/auth/forgot-password-input.dto.js';
import { Result, ok } from '../../common/result.js';
import { passwordResetEmail } from '../../../infrastructure/email/templates/password-reset.template.js';

const RESET_TOKEN_EXPIRY_MINUTES = 30;

export class ForgotPasswordUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly jobQueue: JobQueuePort,
    private readonly frontendUrl: string,
    private readonly fromEmail: string,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<Result<void, never>> {
    const agent = await this.agentRepo.findByEmail(input.email);

    // Always return ok to prevent email enumeration
    if (!agent) return ok(undefined);

    // Invalidate any existing tokens for this agent
    await this.resetTokenRepo.deleteByAgentId(agent.id);

    // Generate token: raw token sent via email, hash stored in DB
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await this.resetTokenRepo.create({
      agentId: agent.id,
      tokenHash,
      type: 'reset',
      expiresAt,
    });

    // Compose email
    const resetUrl = `${this.frontendUrl}/reset-password?token=${rawToken}`;
    const email = passwordResetEmail({
      agentName: agent.name,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });

    // Enqueue for async sending
    await this.jobQueue.enqueue('email.send', {
      to: { email: agent.email, name: agent.name },
      from: this.fromEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    return ok(undefined);
  }
}
