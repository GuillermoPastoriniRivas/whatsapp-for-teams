import { Agent } from '../entities/agent.entity.js';
import { AgentStatus } from '../enums/agent-status.enum.js';

export class AssignmentRulesDomainService {
  /**
   * Given a list of candidate agents, returns the best pick
   * based on least activeCount among available agents.
   * Returns null if no agent is available.
   */
  selectBestAgent(candidates: Agent[]): Agent | null {
    const available = candidates.filter((a) => a.status === AgentStatus.AVAILABLE);

    if (available.length === 0) return null;

    return available.reduce((best, current) =>
      current.activeCount < best.activeCount ? current : best,
    );
  }
}
