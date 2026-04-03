import { Agent } from '../../../domain/entities/agent.entity.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PasswordHasherPort } from '../../ports/password-hasher.port.js';
import { CreateAgentInput } from '../../dtos/agent/create-agent-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { EmailAlreadyExistsError } from '../../../domain/errors/domain-errors.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentStatus } from '../../../domain/enums/agent-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';

export class CreateAgentUseCase {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: CreateAgentInput): Promise<Result<Agent, EmailAlreadyExistsError>> {
    const existing = await this.agentRepo.findByEmail(input.email);
    if (existing) return err(new EmailAlreadyExistsError());

    const passwordHash = await this.passwordHasher.hash(input.password);

    const agent = await this.agentRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? AgentRole.AGENT,
      status: AgentStatus.AVAILABLE,
      activeCount: 0,
      type: AgentType.HUMAN,
      frozen: false,
    });

    return ok(agent);
  }
}
