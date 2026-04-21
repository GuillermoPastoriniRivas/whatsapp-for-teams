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

export interface AiMultiMessageConfig {
  enabled: boolean;
  maxBubbles: number;
  interBubbleDelayMs: number;
  debounceWindowMs: number;
  debounceMaxWaitMs: number;
}

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface BusinessHoursRange {
  open: string;  // 'HH:mm' 24h
  close: string; // 'HH:mm' 24h, may be earlier than open to indicate wrap past midnight
}

export type BusinessHours = Partial<Record<WeekDay, BusinessHoursRange | null>>;

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
    public readonly goals: string,
    public readonly isActive: boolean,
    public readonly multiMessage: AiMultiMessageConfig,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly timezone: string | null = null,
    public readonly businessHours: BusinessHours | null = null,
  ) {}
}
