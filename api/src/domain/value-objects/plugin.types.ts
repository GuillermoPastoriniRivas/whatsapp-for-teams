import type { PhoneNumberPlugin } from '../enums/phone-number-plugin.enum.js';
import type { CognitiveAction, ActionExecutionResult, IntentResult } from './cognitive-loop.types.js';

export interface PluginContext {
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  tenantId: string;
  agentId: string;
  agentName: string;
  phone: { plugins: PhoneNumberPlugin[] };
  contact: {
    name: string;
    phone?: string;
    email?: string;
    company?: string;
    notes?: string;
    customFields?: Record<string, unknown>;
  } | null;
  tenantLabels: Array<{ id: string; name: string; color: string }>;
  conversationSummary: string | null;
}

export interface PluginPromptContribution {
  intentPromptSections: string[];
  responsePromptSections: string[];
}

export interface PluginActionResult {
  handled: boolean;
  result?: string;
}

export interface CognitivePlugin {
  readonly pluginId: PhoneNumberPlugin;
  readonly displayName: string;

  buildPromptContributions(ctx: PluginContext): Promise<PluginPromptContribution>;

  getHandledActionTypes(): string[];

  executeAction(
    action: CognitiveAction,
    ctx: PluginContext,
    allActionResults: ActionExecutionResult[],
  ): Promise<PluginActionResult>;

  afterActions(
    ctx: PluginContext,
    intentResult: IntentResult,
    actionResults: ActionExecutionResult[],
  ): Promise<{ responseDirective: string | null }>;

  onConversationResolved(conversationId: string): Promise<void>;
}
