import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { AgentPhoneAccessRepository } from '../../../domain/repositories/agent-phone-access.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';

export class GetAgentPhoneAccessUseCase {
  constructor(
    private readonly accessRepo: AgentPhoneAccessRepository,
    private readonly phoneRepo: PhoneNumberRepository,
  ) {}

  async execute(agentId: string): Promise<PhoneNumber[]> {
    const accessList = await this.accessRepo.findByAgentId(agentId);
    const phones: PhoneNumber[] = [];

    for (const access of accessList) {
      const phone = await this.phoneRepo.findById(access.phoneNumberId);
      if (phone) phones.push(phone);
    }

    return phones;
  }
}
