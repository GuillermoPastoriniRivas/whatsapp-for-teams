export class AiUsage {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly aiAgentId: string,
    public readonly date: string,
    public readonly messageCount: number,
    public readonly tokenCount: number,
  ) {}
}
