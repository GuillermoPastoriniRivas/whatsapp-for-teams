import { AgentPhoneAccess } from '../../../domain/entities/agent-phone-access.entity.js';
import { AgentPhoneAccessRepository } from '../../../domain/repositories/agent-phone-access.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { Result, ok, err } from '../../common/result.js';
import {
  AgentNotFoundError,
  PhoneNumberNotFoundError,
  PhoneAccessAlreadyExistsError,
  CrossTenantAccessError,
} from '../../../domain/errors/domain-errors.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';

export interface GrantPhoneAccessInput {
  agentId: string;
  phoneNumberId: string;
  tenantId: string;
}

export class GrantPhoneAccessUseCase {
  constructor(
    private readonly accessRepo: AgentPhoneAccessRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly agentRepo: AgentRepository,
  ) {}

  async execute(input: GrantPhoneAccessInput): Promise<Result<AgentPhoneAccess, DomainError>> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) return err(new AgentNotFoundError());
    if (agent.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    const phone = await this.phoneRepo.findById(input.phoneNumberId);
    if (!phone) return err(new PhoneNumberNotFoundError());
    if (phone.tenantId !== input.tenantId) return err(new CrossTenantAccessError());

    const exists = await this.accessRepo.exists(input.agentId, input.phoneNumberId);
    if (exists) return err(new PhoneAccessAlreadyExistsError());

    const access = await this.accessRepo.create({
      agentId: input.agentId,
      phoneNumberId: input.phoneNumberId,
    });

    return ok(access);
  }
}
