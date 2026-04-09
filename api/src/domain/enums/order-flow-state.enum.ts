/**
 * Lifecycle state for order collection flows.
 *
 * This is NOT a step-by-step state machine — the "what to ask next"
 * is derived from data completeness by the SlotFillingEngine.
 * These states only track the lifecycle: idle → collecting → completed.
 */
export enum OrderFlowState {
  /** No active order flow */
  IDLE = 'idle',
  /** Actively collecting order data */
  COLLECTING = 'collecting',
  /** Order was just created */
  ORDER_CREATED = 'order_created',
}
