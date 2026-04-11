import { OrderFlowState } from '../enums/order-flow-state.enum.js';
import type {
  OrderFlowData,
  OrderFlowItem,
  CustomerInput,
  TransitionResult,
  LastOrderDefaults,
} from '../value-objects/order-flow.types.js';
import { createDefaultOrderFlow } from '../value-objects/order-flow.types.js';
import { SlotFillingEngine } from './slot-filling.engine.js';
import type { SlotDefinition, SlotFillingAdapter } from '../value-objects/slot-filling.types.js';

/**
 * Domain service for the order collection flow.
 *
 * Uses SlotFillingEngine for data-completeness-driven flow instead of
 * a rigid state machine. Data is never silently dropped — every customer
 * input is always applied, and "what to ask next" is derived from which
 * slots are still missing.
 */
export class OrderFlowDomainService implements SlotFillingAdapter {

  private readonly engine = new SlotFillingEngine();

  // ── Slot definitions ──────────────────────────────────────────────────

  getSlotDefinitions(): SlotDefinition[] {
    return [
      {
        key: 'items',
        required: true,
        priority: 1,
        askDirective: 'Ask the customer what they would like to order. Show relevant menu options from the knowledge base. Do NOT assume items or quantities — only record what the customer explicitly says.',
      },
      {
        key: 'deliveryType',
        required: true,
        priority: 2,
        askDirective: 'Ask the customer if they want delivery (domicilio) or pickup (recoger en tienda). You MUST ask this question — do NOT assume or skip it. Wait for their answer before proceeding.',
      },
      {
        key: 'deliveryAddress',
        required: true,
        priority: 3,
        askDirective: 'Ask the customer for their delivery address. Do NOT use an address unless the customer provides or confirms it.',
        condition: (data) => data.deliveryType === 'delivery',
      },
      {
        key: 'neighborhood',
        required: true,
        priority: 3.5,
        askDirective: 'We need the customer\'s neighborhood (barrio) to calculate the delivery cost. Ask: "¿En qué barrio queda esa dirección?" Do NOT guess the neighborhood. Do NOT say you will verify with the team.',
        condition: (data) => data.deliveryType === 'delivery',
      },
      {
        key: 'paymentMethod',
        required: true,
        priority: 4,
        askDirective: 'Ask the customer for their payment method (Efectivo, Nequi, Daviplata, or Tarjeta). Do NOT assume a payment method — wait for the customer to choose.',
        condition: (data) => data.deliveryType === 'delivery',
      },
    ];
  }

  // ── SlotFillingAdapter: map AI input → slot values ────────────────────

  mapInputToSlots(input: Record<string, unknown>): Record<string, unknown> {
    const ci = input as unknown as CustomerInput;
    const slots: Record<string, unknown> = {};

    if (ci.items?.length) slots.items = ci.items;
    if (ci.deliveryType) slots.deliveryType = ci.deliveryType;
    if (ci.address) slots.deliveryAddress = ci.address;
    if (ci.neighborhood) slots.neighborhood = ci.neighborhood;
    if (ci.deliveryNotes) slots.deliveryNotes = ci.deliveryNotes;
    if (ci.paymentMethod) slots.paymentMethod = ci.paymentMethod;
    if (ci.customerName) slots.customerName = ci.customerName;
    if (ci.customerPhone) slots.customerPhone = ci.customerPhone;
    if (ci.currency) slots.currency = ci.currency;
    if (ci.deliveryCost !== undefined) slots.deliveryCost = ci.deliveryCost;
    if (ci.source) slots.source = ci.source;

    // When switching to pickup, clear delivery-specific fields
    if (ci.deliveryType === 'pickup') {
      slots.deliveryAddress = null;
      slots.neighborhood = null;
      slots.deliveryCost = null;
    }

    return slots;
  }

  isSlotFilled(_key: string, value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  enrichDirective(directive: string, slotKey: string, defaults: Record<string, unknown> | null): string {
    if (!defaults) return directive;

    const suggestions: Record<string, string> = {
      deliveryType: defaults.deliveryType
        ? ` The customer previously chose ${defaults.deliveryType === 'delivery' ? 'delivery (domicilio)' : 'pickup (recoger en tienda)'}. You can suggest this option.`
        : '',
      deliveryAddress: defaults.deliveryAddress
        ? ` The customer's last delivery was to: ${defaults.deliveryAddress}${defaults.neighborhood ? ` (${defaults.neighborhood})` : ''}. Suggest using this address.`
        : '',
      paymentMethod: defaults.paymentMethod
        ? ` The customer previously paid with ${defaults.paymentMethod}. Suggest this payment method.`
        : '',
    };

    return directive + (suggestions[slotKey] ?? '');
  }

  // ── Main transition logic ─────────────────────────────────────────────

  transition(current: OrderFlowData, input: CustomerInput, lastOrderDefaults?: LastOrderDefaults): TransitionResult {
    // ── Global intents (work from any lifecycle state) ──

    if (input.intent === 'cancel_order') {
      return {
        newFlow: createDefaultOrderFlow(),
        directive: 'The customer cancelled their order. Acknowledge the cancellation briefly.',
        shouldCreateOrder: false,
        shouldUpdateOrder: false,
      };
    }

    if (input.intent === 'track_order') {
      return this.noChange(current, 'The customer is asking about their order status. Use the existing order data to inform them about the current status of their order(s).');
    }

    if (input.intent === 'browse_menu') {
      // If we're collecting, keep the data. If idle, stay idle.
      const state = current.state === OrderFlowState.COLLECTING ? OrderFlowState.COLLECTING : current.state;
      return this.noChange(
        { ...current, state, updatedAt: new Date() },
        'Answer the customer\'s specific question about the menu using information from the business knowledge base. If they ask about sizes, flavors, prices, ingredients, or options — answer directly. Only describe the full menu if they ask what\'s available in general. Do NOT send the menu image as a substitute for answering a question.',
      );
    }

    // ── IDLE / ORDER_CREATED: start a new flow or respond naturally ──

    if (current.state === OrderFlowState.IDLE) {
      if (input.intent === 'add_items' && input.items?.length) {
        const base = createDefaultOrderFlow();
        base.state = OrderFlowState.COLLECTING;
        return this.runEngine(base, input, lastOrderDefaults);
      }
      return this.noChange(current, 'Respond naturally to the customer.');
    }

    if (current.state === OrderFlowState.ORDER_CREATED) {
      // Customer wants to modify the existing pending order
      if (input.intent === 'add_items' && input.items?.length) {
        const updated: OrderFlowData = { ...current, state: OrderFlowState.COLLECTING, updatedAt: new Date() };
        return this.runEngine(updated, input, lastOrderDefaults);
      }
      if (input.intent === 'modify_items') {
        const updated: OrderFlowData = {
          ...current,
          state: OrderFlowState.COLLECTING,
          items: input.items?.length ? input.items : current.items,
          updatedAt: new Date(),
        };
        updated.estimatedTotal = this.calculateTotal(updated.items, updated.deliveryCost);
        return this.runEngine(updated, {} as CustomerInput, lastOrderDefaults);
      }
      if (['set_delivery_type', 'set_address', 'set_payment_method'].includes(input.intent)) {
        const updated: OrderFlowData = { ...current, state: OrderFlowState.COLLECTING, updatedAt: new Date() };
        return this.runEngine(updated, input, lastOrderDefaults);
      }
      // No modification intent — respond naturally
      return this.noChange(current, 'Respond naturally to the customer.');
    }

    // ── COLLECTING: always apply data, let engine decide what's next ──

    // Handle confirmation
    if (input.intent === 'confirm_order' && input.confirmed === false) {
      // Customer rejected — stay collecting, let them modify
      return this.noChange(current, 'The customer did not confirm. Ask what they would like to change.');
    }

    if (input.intent === 'modify_items') {
      // Replace items if new ones provided, otherwise keep current
      const updated: OrderFlowData = {
        ...current,
        items: input.items?.length ? input.items : current.items,
        updatedAt: new Date(),
      };
      // Recalculate total
      updated.estimatedTotal = this.calculateTotal(updated.items, updated.deliveryCost);
      return this.runEngine(updated, {} as CustomerInput, lastOrderDefaults);
    }

    // Default: apply ALL data and let the engine decide
    return this.runEngine(current, input, lastOrderDefaults);
  }

  // ── Engine integration ────────────────────────────────────────────────

  private runEngine(flow: OrderFlowData, input: CustomerInput, defaults?: LastOrderDefaults): TransitionResult {
    // Convert OrderFlowData to a generic record for the engine
    const currentData = this.flowToRecord(flow);
    const rawInput = input as unknown as Record<string, unknown>;

    // Convert defaults to a generic record
    const defaultsRecord = defaults ? {
      deliveryType: defaults.deliveryType,
      deliveryAddress: defaults.deliveryAddress,
      neighborhood: defaults.neighborhood,
      paymentMethod: defaults.paymentMethod,
      customerName: defaults.customerName,
      deliveryCost: defaults.deliveryCost,
    } : null;

    const result = this.engine.transition(currentData, rawInput, this, defaultsRecord);

    // Convert back to OrderFlowData
    const newFlow = this.recordToFlow(result.data, flow);

    // Handle item merging (engine does simple overwrite, we need merge)
    if (input.items?.length && flow.items.length > 0) {
      newFlow.items = this.mergeItems(flow.items, input.items);
    }

    // Recalculate total after merge
    newFlow.estimatedTotal = input.estimatedTotal ?? this.calculateTotal(newFlow.items, newFlow.deliveryCost);

    if (result.shouldComplete) {
      // Web orders or confirmed orders → create immediately
      const orderData = {
        items: newFlow.items,
        type: newFlow.deliveryType!,
        address: newFlow.deliveryAddress ?? undefined,
        notes: newFlow.deliveryNotes ?? undefined,
        total: newFlow.estimatedTotal ?? undefined,
        currency: newFlow.currency ?? undefined,
        paymentMethod: newFlow.paymentMethod ?? undefined,
        customerName: newFlow.customerName ?? undefined,
        customerPhone: newFlow.customerPhone ?? undefined,
        deliveryCost: newFlow.deliveryCost ?? undefined,
        neighborhood: newFlow.neighborhood ?? undefined,
      };

      const isUpdate = !!flow.activeOrderId;
      return {
        newFlow: { ...newFlow, state: OrderFlowState.ORDER_CREATED, updatedAt: new Date() },
        directive: isUpdate
          ? 'The order has been UPDATED. Send a SHORT confirmation mentioning only what changed. Do NOT repeat the full order details.'
          : 'The order has been REGISTERED and sent to the team for preparation. Send a SHORT confirmation with the total (including delivery if applicable). Do NOT repeat the full list of items or details the customer already knows — they can scroll up. IMPORTANT: Do NOT say the order is "ready" or "lista" — it has only been registered and still needs to be prepared. Do NOT mention preparation times or ETAs unless they are in the knowledge base.',
        shouldCreateOrder: !isUpdate,
        shouldUpdateOrder: isUpdate,
        orderData,
      };
    }

    // Still collecting — build directive with context
    return {
      newFlow: { ...newFlow, state: OrderFlowState.COLLECTING, updatedAt: new Date() },
      directive: result.directive,
      shouldCreateOrder: false,
      shouldUpdateOrder: false,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private flowToRecord(flow: OrderFlowData): Record<string, unknown> {
    return {
      items: flow.items,
      deliveryType: flow.deliveryType,
      deliveryAddress: flow.deliveryAddress,
      deliveryNotes: flow.deliveryNotes,
      estimatedTotal: flow.estimatedTotal,
      currency: flow.currency,
      paymentMethod: flow.paymentMethod,
      customerName: flow.customerName,
      customerPhone: flow.customerPhone,
      neighborhood: flow.neighborhood,
      deliveryCost: flow.deliveryCost,
      source: flow.source,
    };
  }

  private recordToFlow(data: Record<string, unknown>, base: OrderFlowData): OrderFlowData {
    return {
      ...base,
      items: (data.items as OrderFlowItem[]) ?? base.items,
      deliveryType: (data.deliveryType as OrderFlowData['deliveryType']) ?? base.deliveryType,
      deliveryAddress: (data.deliveryAddress as string | null) ?? base.deliveryAddress,
      deliveryNotes: (data.deliveryNotes as string | null) ?? base.deliveryNotes,
      estimatedTotal: (data.estimatedTotal as number | null) ?? base.estimatedTotal,
      currency: (data.currency as string | null) ?? base.currency,
      paymentMethod: (data.paymentMethod as string | null) ?? base.paymentMethod,
      customerName: (data.customerName as string | null) ?? base.customerName,
      customerPhone: (data.customerPhone as string | null) ?? base.customerPhone,
      neighborhood: (data.neighborhood as string | null) ?? base.neighborhood,
      deliveryCost: (data.deliveryCost as number | null) ?? base.deliveryCost,
      source: (data.source as OrderFlowData['source']) ?? base.source,
      updatedAt: new Date(),
    };
  }

  private mergeItems(existing: OrderFlowItem[], incoming: OrderFlowItem[]): OrderFlowItem[] {
    const merged = [...existing];
    for (const item of incoming) {
      const idx = merged.findIndex(
        (e) => e.name.toLowerCase().trim() === item.name.toLowerCase().trim(),
      );
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...item };
      } else {
        merged.push(item);
      }
    }
    return merged;
  }

  private calculateTotal(items: OrderFlowItem[], deliveryCost: number | null): number | null {
    const allHavePrices = items.every((i) => typeof i.unitPrice === 'number');
    if (!allHavePrices) return null;
    const itemsTotal = items.reduce((sum, i) => sum + i.quantity * (i.unitPrice ?? 0), 0);
    return itemsTotal + (deliveryCost ?? 0);
  }

  private noChange(flow: OrderFlowData, directive: string): TransitionResult {
    return { newFlow: flow, directive, shouldCreateOrder: false, shouldUpdateOrder: false };
  }
}
