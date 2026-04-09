import { OrderFlowState } from '../enums/order-flow-state.enum.js';
import type {
  OrderFlowData,
  OrderFlowItem,
  CustomerInput,
  TransitionResult,
  LastOrderDefaults,
} from '../value-objects/order-flow.types.js';
import { createDefaultOrderFlow } from '../value-objects/order-flow.types.js';
import { DeliveryCostDomainService } from './delivery-cost.domain-service.js';

/**
 * Pure domain service — no side effects, no repository calls.
 * Controls the order flow state machine: given current state + customer input,
 * returns the next state, a directive for the response LLM, and whether an order should be created.
 */
export class OrderFlowDomainService {
  private readonly deliveryCost = new DeliveryCostDomainService();

  transition(current: OrderFlowData, input: CustomerInput, lastOrderDefaults?: LastOrderDefaults): TransitionResult {
    // Cancel from any state
    if (input.intent === 'cancel_order') {
      return {
        newFlow: createDefaultOrderFlow(),
        directive: 'The customer cancelled their order. Acknowledge the cancellation briefly.',
        shouldCreateOrder: false,
      };
    }

    // Track order — respond with status info without changing state
    if (input.intent === 'track_order') {
      return this.noChange(current, 'The customer is asking about their order status. Use the existing order data to inform them about the current status of their order(s).');
    }

    switch (current.state) {
      case OrderFlowState.IDLE:
      case OrderFlowState.ORDER_CREATED:
        return this.fromIdle(current, input, lastOrderDefaults);
      case OrderFlowState.BROWSING_MENU:
        return this.fromBrowsingMenu(current, input);
      case OrderFlowState.COLLECTING_ITEMS:
        return this.fromCollectingItems(current, input);
      case OrderFlowState.COLLECTING_ADDRESS:
        return this.fromCollectingAddress(current, input);
      case OrderFlowState.COLLECTING_PAYMENT:
        return this.fromCollectingPayment(current, input);
      case OrderFlowState.CONFIRMING_ORDER:
        return this.fromConfirmingOrder(current, input);
      default:
        return this.noChange(current, 'Respond naturally to the customer.');
    }
  }

  // ── State handlers ────────────────────────────────────────────────────

  private fromIdle(current: OrderFlowData, input: CustomerInput, defaults?: LastOrderDefaults): TransitionResult {
    if (input.intent === 'browse_menu') {
      return this.noChange(
        { ...current, state: OrderFlowState.BROWSING_MENU, updatedAt: new Date() },
        'Help the customer browse the menu. Describe available products based on business knowledge.',
      );
    }

    if (input.intent === 'add_items' && input.items?.length) {
      // Start a new order flow, pre-filling with last order defaults if available
      const base = createDefaultOrderFlow();
      const prefilled = defaults ? this.applyDefaults(base, defaults) : base;
      const flow = this.applyData(prefilled, input);

      // Inject delivery cost if neighborhood is known
      const withCost = this.injectDeliveryCost(flow);

      return this.autoAdvance(withCost, defaults);
    }

    // Any other intent while idle — just respond normally
    return this.noChange(current, 'Respond naturally to the customer.');
  }

  private fromBrowsingMenu(current: OrderFlowData, input: CustomerInput): TransitionResult {
    if (input.intent === 'add_items' && input.items?.length) {
      const flow = this.applyData(current, input);
      const withCost = this.injectDeliveryCost(flow);
      return this.autoAdvance(withCost);
    }

    if (input.intent === 'browse_menu' || input.intent === 'other') {
      return this.noChange(current, 'Continue helping the customer browse the menu.');
    }

    return this.noChange(current, 'Respond naturally to the customer.');
  }

  private fromCollectingItems(current: OrderFlowData, input: CustomerInput): TransitionResult {
    if (input.intent === 'add_items' && input.items?.length) {
      const flow = this.applyData(current, input);
      const withCost = this.injectDeliveryCost(flow);
      return this.autoAdvance(withCost);
    }

    if (input.intent === 'modify_items') {
      if (input.items?.length) {
        // Replace items entirely
        const flow: OrderFlowData = {
          ...current,
          items: input.items,
          estimatedTotal: input.estimatedTotal ?? this.calculateTotal(input.items, current.deliveryCost),
          currency: input.currency ?? current.currency,
          updatedAt: new Date(),
        };
        return this.autoAdvance(flow);
      }
      return this.noChange(current, 'Ask the customer what items they want to change.');
    }

    if (input.intent === 'set_delivery_type' && input.deliveryType) {
      const flow = this.applyData(current, input);
      const withCost = this.injectDeliveryCost(flow);
      return this.autoAdvance(withCost);
    }

    if (input.intent === 'set_payment_method' && input.paymentMethod) {
      const flow = this.applyData(current, input);
      return this.autoAdvance(flow);
    }

    if (input.intent === 'other') {
      return this.autoAdvance(current);
    }

    return this.autoAdvance(this.applyData(current, input));
  }

  private fromCollectingAddress(current: OrderFlowData, input: CustomerInput): TransitionResult {
    if (input.intent === 'set_address' && input.address) {
      const flow: OrderFlowData = {
        ...current,
        deliveryAddress: input.address,
        deliveryNotes: input.deliveryNotes ?? current.deliveryNotes,
        neighborhood: input.neighborhood ?? current.neighborhood,
        updatedAt: new Date(),
      };
      const withCost = this.injectDeliveryCost(flow);
      return this.autoAdvance(withCost);
    }

    // Customer may provide address + payment + other data in one message
    if (input.intent === 'add_items' && input.items?.length) {
      const flow = this.applyData(current, input);
      const withCost = this.injectDeliveryCost(flow);
      return this.autoAdvance(withCost);
    }

    if (input.intent === 'modify_items') {
      const flow: OrderFlowData = {
        ...current,
        state: OrderFlowState.COLLECTING_ITEMS,
        items: input.items?.length ? input.items : current.items,
        updatedAt: new Date(),
      };
      return this.autoAdvance(flow);
    }

    // Apply any data the customer provides (address in params, neighborhood, etc.)
    if (input.address || input.neighborhood) {
      const flow = this.applyData(current, input);
      const withCost = this.injectDeliveryCost(flow);
      return this.autoAdvance(withCost);
    }

    // Customer said something but didn't provide address
    return this.noChange(current, 'Ask the customer for their delivery address and neighborhood (barrio).');
  }

  private fromCollectingPayment(current: OrderFlowData, input: CustomerInput): TransitionResult {
    if (input.intent === 'set_payment_method' && input.paymentMethod) {
      const flow: OrderFlowData = {
        ...current,
        paymentMethod: input.paymentMethod,
        updatedAt: new Date(),
      };
      return this.autoAdvance(flow);
    }

    // Customer may say payment method in a natural way captured as other intent
    if (input.paymentMethod) {
      const flow: OrderFlowData = {
        ...current,
        paymentMethod: input.paymentMethod,
        updatedAt: new Date(),
      };
      return this.autoAdvance(flow);
    }

    if (input.intent === 'modify_items') {
      const flow: OrderFlowData = {
        ...current,
        state: OrderFlowState.COLLECTING_ITEMS,
        items: input.items?.length ? input.items : current.items,
        updatedAt: new Date(),
      };
      return this.autoAdvance(flow);
    }

    return this.noChange(current, 'Ask the customer for their payment method (Efectivo, Nequi, Daviplata, or Tarjeta).');
  }

  private fromConfirmingOrder(current: OrderFlowData, input: CustomerInput): TransitionResult {
    if (input.intent === 'confirm_order' && input.confirmed === true) {
      const orderData = {
        items: current.items,
        type: current.deliveryType!,
        address: current.deliveryAddress ?? undefined,
        notes: current.deliveryNotes ?? undefined,
        total: current.estimatedTotal ?? undefined,
        currency: current.currency ?? undefined,
        paymentMethod: current.paymentMethod ?? undefined,
        customerName: current.customerName ?? undefined,
        customerPhone: current.customerPhone ?? undefined,
        deliveryCost: current.deliveryCost ?? undefined,
        neighborhood: current.neighborhood ?? undefined,
      };

      return {
        newFlow: { ...current, state: OrderFlowState.ORDER_CREATED, updatedAt: new Date() },
        directive: 'Tell the customer their order has been created successfully. Include a brief summary with the total (including delivery cost if applicable).',
        shouldCreateOrder: true,
        orderData,
      };
    }

    if (input.intent === 'confirm_order' && input.confirmed === false) {
      return {
        newFlow: { ...current, state: OrderFlowState.COLLECTING_ITEMS, updatedAt: new Date() },
        directive: 'The customer did not confirm. Ask what they would like to change.',
        shouldCreateOrder: false,
      };
    }

    if (input.intent === 'modify_items') {
      const flow: OrderFlowData = {
        ...current,
        state: OrderFlowState.COLLECTING_ITEMS,
        items: input.items?.length ? input.items : current.items,
        updatedAt: new Date(),
      };
      return this.autoAdvance(flow);
    }

    if (input.intent === 'add_items' && input.items?.length) {
      const flow = this.applyData({ ...current, state: OrderFlowState.COLLECTING_ITEMS }, input);
      return this.autoAdvance(flow);
    }

    // Still waiting for confirmation
    return this.noChange(current, this.buildConfirmationDirective(current));
  }

  // ── Auto-advance logic ────────────────────────────────────────────────

  private autoAdvance(flow: OrderFlowData, defaults?: LastOrderDefaults): TransitionResult {
    // No items yet — stay or move to collecting_items
    if (flow.items.length === 0) {
      return this.noChange(
        { ...flow, state: OrderFlowState.COLLECTING_ITEMS, updatedAt: new Date() },
        'Ask the customer what they would like to order.',
      );
    }

    // Has items but no delivery type
    if (!flow.deliveryType) {
      // Build directive that suggests previous delivery type if available
      const suggestion = defaults?.deliveryType
        ? ` The customer previously chose ${defaults.deliveryType === 'delivery' ? 'delivery' : 'pickup'}. You can suggest this.`
        : '';
      return this.noChange(
        { ...flow, state: OrderFlowState.COLLECTING_ITEMS, updatedAt: new Date() },
        `Ask the customer if they want delivery or pickup.${suggestion}`,
      );
    }

    // Delivery but no address
    if (flow.deliveryType === 'delivery' && !flow.deliveryAddress) {
      const suggestion = defaults?.deliveryAddress
        ? ` The customer's last delivery address was: ${defaults.deliveryAddress}${defaults.neighborhood ? ` (${defaults.neighborhood})` : ''}. Suggest using this address.`
        : '';
      return this.noChange(
        { ...flow, state: OrderFlowState.COLLECTING_ADDRESS, updatedAt: new Date() },
        `Ask the customer for their delivery address and neighborhood (barrio).${suggestion}`,
      );
    }

    // Delivery but no payment method
    if (!flow.paymentMethod) {
      const suggestion = defaults?.paymentMethod
        ? ` The customer previously paid with ${defaults.paymentMethod}. Suggest using this payment method.`
        : '';
      return this.noChange(
        { ...flow, state: OrderFlowState.COLLECTING_PAYMENT, updatedAt: new Date() },
        `Ask the customer for their payment method (Efectivo, Nequi, Daviplata, or Tarjeta).${suggestion}`,
      );
    }

    // All data collected — move to confirmation
    return this.noChange(
      { ...flow, state: OrderFlowState.CONFIRMING_ORDER, updatedAt: new Date() },
      this.buildConfirmationDirective(flow),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private applyDefaults(flow: OrderFlowData, defaults: LastOrderDefaults): OrderFlowData {
    return {
      ...flow,
      deliveryType: defaults.deliveryType ?? flow.deliveryType,
      deliveryAddress: defaults.deliveryAddress ?? flow.deliveryAddress,
      neighborhood: defaults.neighborhood ?? flow.neighborhood,
      paymentMethod: defaults.paymentMethod ?? flow.paymentMethod,
      customerName: defaults.customerName ?? flow.customerName,
      deliveryCost: defaults.deliveryCost ?? flow.deliveryCost,
      updatedAt: new Date(),
    };
  }

  private applyData(flow: OrderFlowData, input: CustomerInput): OrderFlowData {
    const updated = { ...flow, updatedAt: new Date() };

    if (input.items?.length) {
      updated.items = this.mergeItems(flow.items, input.items);
      updated.estimatedTotal = input.estimatedTotal ?? this.calculateTotal(updated.items, updated.deliveryCost);
    }

    if (input.deliveryType) {
      updated.deliveryType = input.deliveryType;
      // If switching to pickup, clear delivery-specific data
      if (input.deliveryType === 'pickup') {
        updated.deliveryAddress = null;
        updated.neighborhood = null;
        updated.deliveryCost = null;
        // Recalculate total without delivery cost
        updated.estimatedTotal = this.calculateTotal(updated.items, null);
      }
    }

    if (input.address) {
      updated.deliveryAddress = input.address;
    }

    if (input.deliveryNotes) {
      updated.deliveryNotes = input.deliveryNotes;
    }

    if (input.currency) {
      updated.currency = input.currency;
    }

    if (input.paymentMethod) {
      updated.paymentMethod = input.paymentMethod;
    }

    if (input.customerName) {
      updated.customerName = input.customerName;
    }

    if (input.customerPhone) {
      updated.customerPhone = input.customerPhone;
    }

    if (input.neighborhood) {
      updated.neighborhood = input.neighborhood;
    }

    if (input.deliveryCost !== undefined) {
      updated.deliveryCost = input.deliveryCost;
    }

    if (input.source) {
      updated.source = input.source;
    }

    return updated;
  }

  /** Inject delivery cost based on neighborhood if not already set */
  private injectDeliveryCost(flow: OrderFlowData): OrderFlowData {
    if (flow.deliveryType !== 'delivery' || !flow.neighborhood || flow.deliveryCost !== null) {
      return flow;
    }

    const result = this.deliveryCost.lookup(flow.neighborhood);
    if (result.found && result.cost !== null) {
      const updated = { ...flow, deliveryCost: result.cost };
      // Recalculate total with delivery cost
      updated.estimatedTotal = this.calculateTotal(updated.items, updated.deliveryCost);
      return updated;
    }

    return flow;
  }

  private mergeItems(existing: OrderFlowItem[], incoming: OrderFlowItem[]): OrderFlowItem[] {
    const merged = [...existing];
    for (const item of incoming) {
      const idx = merged.findIndex(
        (e) => e.name.toLowerCase().trim() === item.name.toLowerCase().trim(),
      );
      if (idx >= 0) {
        // Update existing item
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

  private buildConfirmationDirective(flow: OrderFlowData): string {
    const itemsSummary = flow.items
      .map((i) => `${i.quantity}x ${i.name}${i.unitPrice ? ` ($${i.unitPrice.toLocaleString('es-CO')})` : ''}${i.notes ? ` (${i.notes})` : ''}`)
      .join(', ');

    const deliveryInfo = flow.deliveryType === 'pickup'
      ? 'Retiro en tienda'
      : `Domicilio a ${flow.deliveryAddress ?? 'TBD'}${flow.neighborhood ? ` (${flow.neighborhood})` : ''}`;

    const deliveryCostInfo = flow.deliveryCost !== null
      ? `Costo de domicilio: $${flow.deliveryCost.toLocaleString('es-CO')}`
      : '';

    const total = flow.estimatedTotal !== null
      ? `Total: $${flow.estimatedTotal.toLocaleString('es-CO')} ${flow.currency ?? 'COP'}`
      : '';

    const paymentInfo = flow.paymentMethod
      ? `Medio de pago: ${flow.paymentMethod}`
      : '';

    return `Confirm the order with the customer. Summary: ${itemsSummary}. ${deliveryInfo}. ${deliveryCostInfo}. ${total}. ${paymentInfo}. Ask them to confirm or make changes.`.trim();
  }

  private noChange(flow: OrderFlowData, directive: string): TransitionResult {
    return { newFlow: flow, directive, shouldCreateOrder: false };
  }
}
