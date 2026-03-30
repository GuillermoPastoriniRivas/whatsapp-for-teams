import { AiProvider } from '../enums/ai-provider.enum.js';

export interface AiPersona {
  role: string;
  tone: string;
  language: string;
  instructions: string;
}

export interface HandoffRules {
  keywords: string[];
  maxConsecutiveFailures: number;
  onCustomerRequest: boolean;
  urgencyKeywords: string[];
}

export interface AiContextConfig {
  maxHistoryMessages: number;
  includeContactInfo: boolean;
}

export interface AiRateLimits {
  maxMessagesPerDay: number;
  maxTokensPerDay: number;
}

export class AiAgentConfig {
  constructor(
    public readonly id: string,
    public readonly agentId: string,
    public readonly tenantId: string,
    public readonly provider: AiProvider,
    public readonly model: string,
    public readonly apiKey: string,
    public readonly systemPrompt: string,
    public readonly knowledgeBase: string,
    public readonly persona: AiPersona,
    public readonly handoffRules: HandoffRules,
    public readonly contextConfig: AiContextConfig,
    public readonly rateLimits: AiRateLimits,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
