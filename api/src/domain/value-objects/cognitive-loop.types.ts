export type CoreIntentType =
  | 'respond'
  | 'update_contact'
  | 'add_label'
  | 'remove_label'
  | 'escalate'
  | 'complete_goal'
  | 'update_summary';

// Open to extension by plugins (e.g., 'extract_order_data', 'create_order', 'check_availability')
export type IntentType = CoreIntentType | (string & {});

export interface CognitiveAction {
  type: IntentType;
  params: Record<string, unknown>;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  actions: CognitiveAction[];
  responseHint: string;
}

export interface ActionExecutionResult {
  action: CognitiveAction;
  success: boolean;
  result?: string;
  error?: string;
}
