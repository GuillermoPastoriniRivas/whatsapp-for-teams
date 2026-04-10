import type {
  SlotDefinition,
  SlotFillingAdapter,
  SlotTransitionResult,
} from '../value-objects/slot-filling.types.js';

/**
 * Generic engine for collecting structured data through conversation.
 *
 * Core guarantees:
 * 1. Data is NEVER silently dropped — every input is always applied.
 * 2. "What to ask next" is derived from data completeness, not from state.
 * 3. The conversation order is a suggestion (priority), not enforced.
 *
 * Plugins provide slot definitions and hooks via SlotFillingAdapter.
 * The engine handles the apply → check → directive cycle.
 */
export class SlotFillingEngine {

  /**
   * Process customer input and determine next step.
   *
   * @param currentData  - Current accumulated flow data (from DB)
   * @param rawInput     - Raw AI action params (extract_order_data params, etc.)
   * @param adapter      - Plugin-specific slot definitions and hooks
   * @param defaults     - Last-order defaults for directive enrichment (optional)
   */
  transition(
    currentData: Record<string, unknown>,
    rawInput: Record<string, unknown>,
    adapter: SlotFillingAdapter,
    defaults?: Record<string, unknown> | null,
  ): SlotTransitionResult {
    // 1. Map raw input to slot values and merge (always apply ALL data)
    const mappedInput = adapter.mapInputToSlots(rawInput);
    const updated = this.mergeData(currentData, mappedInput);

    // 2. Evaluate which slots are filled vs missing
    const slots = adapter.getSlotDefinitions();
    const { filled, missing } = this.evaluateSlots(slots, updated, adapter);

    // 3. If nothing missing → ready to complete
    if (missing.length === 0) {
      return {
        data: updated,
        shouldComplete: true,
        directive: 'All required data has been collected. Confirm the details with the customer with a brief summary before registering the order. Do NOT say the order is "ready" or "lista" — it has not been sent yet.',
        missingSlots: [],
        filledSlots: filled.map((s) => s.key),
      };
    }

    // 4. Build directive for the highest-priority missing slot
    const nextSlot = missing[0];
    let directive = nextSlot.askDirective;

    // Enrich with defaults if the adapter supports it
    if (adapter.enrichDirective) {
      directive = adapter.enrichDirective(directive, nextSlot.key, defaults ?? null);
    }

    return {
      data: updated,
      shouldComplete: false,
      directive,
      missingSlots: missing.map((s) => s.key),
      filledSlots: filled.map((s) => s.key),
    };
  }

  /**
   * Evaluate which required slots are filled and which are missing.
   * Returns them sorted by priority.
   */
  private evaluateSlots(
    slots: SlotDefinition[],
    data: Record<string, unknown>,
    adapter: SlotFillingAdapter,
  ): { filled: SlotDefinition[]; missing: SlotDefinition[] } {
    const filled: SlotDefinition[] = [];
    const missing: SlotDefinition[] = [];

    for (const slot of slots) {
      if (!slot.required) continue;

      // Skip conditional slots whose condition is not met
      if (slot.condition && !slot.condition(data)) continue;

      if (this.isSlotFilled(slot.key, data[slot.key], adapter)) {
        filled.push(slot);
      } else {
        missing.push(slot);
      }
    }

    // Sort missing by priority (lower = ask first)
    missing.sort((a, b) => a.priority - b.priority);
    return { filled, missing };
  }

  /** Check if a slot value counts as "filled". */
  private isSlotFilled(
    key: string,
    value: unknown,
    adapter: SlotFillingAdapter,
  ): boolean {
    // Let the adapter override with custom logic
    if (adapter.isSlotFilled) {
      return adapter.isSlotFilled(key, value);
    }

    // Default: non-null, non-undefined, and arrays must have length > 0
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  /**
   * Merge new data into current data.
   * Only overwrites keys that have non-undefined values in the input.
   */
  private mergeData(
    current: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...current };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
}
