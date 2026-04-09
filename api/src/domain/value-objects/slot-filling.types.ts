/**
 * Generic slot-filling types for conversational data collection.
 *
 * Used by any plugin that needs to collect structured data through
 * conversation (orders, calendar bookings, etc.). The SlotFillingEngine
 * guarantees that data is never silently dropped — every input is always
 * applied, and the "what to ask next" is derived from data completeness.
 */

/** Lifecycle state — not a flow step, just "are we collecting or not?" */
export enum CollectionFlowState {
  IDLE = 'idle',
  COLLECTING = 'collecting',
  COMPLETED = 'completed',
}

/** A single piece of data to collect from the customer. */
export interface SlotDefinition {
  /** Unique key for this slot (e.g. 'items', 'deliveryType', 'address') */
  key: string;

  /** Whether this slot must be filled before completing */
  required: boolean;

  /**
   * Lower number = ask first. Determines the suggested conversation order,
   * but the engine will accept data for any slot at any time.
   */
  priority: number;

  /** Directive text for the AI when this slot is missing */
  askDirective: string;

  /**
   * Optional condition: this slot is only required when the condition returns true.
   * E.g. address is only required when deliveryType === 'delivery'.
   */
  condition?: (flowData: Record<string, unknown>) => boolean;
}

/**
 * Contract that plugins implement to use the SlotFillingEngine.
 * Each plugin defines its slots and provides hooks for plugin-specific logic.
 */
export interface SlotFillingAdapter {
  /** Define what data to collect. Called on each transition. */
  getSlotDefinitions(): SlotDefinition[];

  /**
   * Map raw AI action params to slot key-value pairs.
   * Only include keys that the customer actually provided.
   */
  mapInputToSlots(input: Record<string, unknown>): Record<string, unknown>;

  /**
   * Check whether a slot is filled. Default: value is not null/undefined
   * and arrays have length > 0. Override for custom logic.
   */
  isSlotFilled?(key: string, value: unknown): boolean;

  /**
   * Async hook called when all required slots are filled, BEFORE creating the resource.
   * Use for validations like checking calendar availability.
   * Return { ok: false, directive } to block completion and ask the customer for changes.
   */
  beforeComplete?(flowData: Record<string, unknown>): Promise<{ ok: boolean; directive?: string }>;

  /**
   * Enrich a directive with customer defaults/suggestions.
   * E.g. "Ask for address. Last time they used: Calle 123, San Rafael."
   */
  enrichDirective?(directive: string, slotKey: string, defaults: Record<string, unknown> | null): string;
}

/** Result of a slot-filling transition. */
export interface SlotTransitionResult {
  /** Updated flow data after applying input */
  data: Record<string, unknown>;

  /** Whether all required slots are filled and the flow should complete */
  shouldComplete: boolean;

  /** Directive for the response AI (what to ask or confirm) */
  directive: string;

  /** List of slot keys that are still missing */
  missingSlots: string[];

  /** List of slot keys that are filled */
  filledSlots: string[];
}
