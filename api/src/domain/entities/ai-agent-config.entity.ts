export type BusinessVertical = 'beauty' | 'food' | 'retail' | 'generic';

export interface CatalogItem {
  name: string;
  price: string; // free text: "$8.000", "desde $5.000"
  description: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface BusinessProfile {
  vertical: BusinessVertical;
  businessName: string;
  description: string;
  address: string;
  paymentMethods: string;
  catalog: CatalogItem[];
  faqs: FaqEntry[];
  extraNotes: string;
}

export interface BotBehavior {
  language: string; // 'es', 'en', 'pt', ...
  formality: 'informal' | 'formal';
  useEmojis: boolean;
  goal: string; // one-line conversation objective, optional
  customInstructions: string; // advanced escape hatch, optional
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
    public readonly businessProfile: BusinessProfile,
    public readonly behavior: BotBehavior,
    public readonly handoffRules: HandoffRules,
    public readonly contextConfig: AiContextConfig,
    public readonly rateLimits: AiRateLimits,
    public readonly isActive: boolean,
    public readonly multiMessage: AiMultiMessageConfig,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly timezone: string | null = null,
    public readonly businessHours: BusinessHours | null = null,
  ) {}
}
