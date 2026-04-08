export type IntentType =
  | 'respond'
  | 'create_order'
  | 'update_contact'
  | 'add_label'
  | 'remove_label'
  | 'escalate'
  | 'complete_goal'
  | 'update_summary';

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
