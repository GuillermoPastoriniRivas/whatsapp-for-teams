import { randomBytes, createHash } from 'crypto';
import { Agent } from '../../../domain/entities/agent.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import { PasswordResetTokenRepository } from '../../../domain/repositories/password-reset-token.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { InviteAgentInput } from '../../dtos/agent/invite-agent-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { EmailAlreadyExistsError } from '../../../domain/errors/domain-errors.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';
import { agentInvitationEmail } from '../../../infrastructure/email/templates/agent-invitation.template.js';

const INVITATION_TOKEN_EXPIRY_HOURS = 72;

export class InviteAgentUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly jobQueue: JobQueuePort,
    private readonly frontendUrl: string,
    private readonly fromEmail: string,
  ) {}

  async execute(input: InviteAgentInput): Promise<Result<Agent, EmailAlreadyExistsError>> {
    const existing = await this.agentRepo.findByEmail(input.email);
    if (existing) return err(new EmailAlreadyExistsError());

    // Create agent with a random placeholder password (cannot login with it)
    const placeholderHash = randomBytes(32).toString('hex');

    const agent = await this.agentRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      passwordHash: placeholderHash,
      role: input.role ?? AgentRole.AGENT,
      status: AgentStatus.AVAILABLE,
      activeCount: 0,
      type: AgentType.HUMAN,
      frozen: false,
      emailVerified: true,
    });

    // Generate invitation token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.resetTokenRepo.create({
      agentId: agent.id,
      tokenHash,
      type: 'invitation',
      expiresAt,
    });

    // Get tenant name for the email
    const tenant = await this.tenantRepo.findById(input.tenantId);
    const tenantName = tenant?.name ?? 'asis.chat';

    // Compose and enqueue invitation email
    const inviteUrl = `${this.frontendUrl}/accept-invite?token=${rawToken}`;
    const email = agentInvitationEmail({
      agentName: input.name,
      inviterName: input.inviterName,
      tenantName,
      inviteUrl,
      expiresInHours: INVITATION_TOKEN_EXPIRY_HOURS,
    });

    await this.jobQueue.enqueue('email.send', {
      to: { email: input.email, name: input.name },
      from: this.fromEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    return ok(agent);
  }
}
