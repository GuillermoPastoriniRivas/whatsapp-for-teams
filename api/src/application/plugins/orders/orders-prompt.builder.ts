import { OrderFlowState } from '../../../domain/enums/order-flow-state.enum.js';
import type { OrderFlowData } from '../../../domain/value-objects/order-flow.types.js';

export interface OrderPromptContext {
  orders: Array<{
    id: string;
    status: string;
    items: Array<{ name: string; quantity: number; unitPrice?: number }>;
    deliveryType: string;
    deliveryAddress?: string | null;
    estimatedTotal?: number | null;
    currency?: string | null;
    createdAt: Date;
    paymentMethod?: string | null;
    neighborhood?: string | null;
  }>;
  orderFlow: OrderFlowData;
  lastOrderDefaults?: {
    deliveryAddress?: string;
    neighborhood?: string;
    paymentMethod?: string;
    customerName?: string;
  } | null;
}

export function buildOrderIntentSections(ctx: OrderPromptContext): string[] {
  const sections: string[] = [];
  const { orderFlow, orders, lastOrderDefaults } = ctx;

  const flowActive = orderFlow.state === OrderFlowState.COLLECTING;

  if (flowActive) {
    const collectedData: string[] = [];
    const missingData: string[] = [];

    // Track what's collected
    if (orderFlow.items.length > 0) {
      collectedData.push(`Items: ${orderFlow.items.map((i) => `${i.quantity}x ${i.name}${i.unitPrice ? ` ($${i.unitPrice})` : ''}${i.notes ? ` (${i.notes})` : ''}`).join(', ')}`);
    } else {
      missingData.push('Items (what the customer wants to order)');
    }

    if (orderFlow.deliveryType) {
      collectedData.push(`Delivery type: ${orderFlow.deliveryType}`);
    } else {
      missingData.push('Delivery type (delivery or pickup)');
    }

    if (orderFlow.deliveryType === 'delivery') {
      if (orderFlow.deliveryAddress) {
        collectedData.push(`Address: ${orderFlow.deliveryAddress}`);
      } else {
        missingData.push('Delivery address and neighborhood (barrio)');
      }
    }

    if (orderFlow.neighborhood) collectedData.push(`Neighborhood: ${orderFlow.neighborhood}`);
    if (orderFlow.deliveryNotes) collectedData.push(`Notes: ${orderFlow.deliveryNotes}`);

    if (orderFlow.paymentMethod) {
      collectedData.push(`Payment method: ${orderFlow.paymentMethod}`);
    } else {
      missingData.push('Payment method');
    }

    if (orderFlow.deliveryCost !== null) collectedData.push(`Delivery cost: $${orderFlow.deliveryCost}`);
    if (orderFlow.estimatedTotal !== null) collectedData.push(`Total: $${orderFlow.estimatedTotal} ${orderFlow.currency ?? ''}`);

    sections.push(`## Order Flow (Active)
${collectedData.length > 0 ? `Data collected so far:\n${collectedData.map((d) => `- ${d}`).join('\n')}` : 'No data collected yet.'}
${missingData.length > 0 ? `\nStill needed (for your reference — extract these IF the customer mentions them, but do NOT ask about all of them at once):\n${missingData.map((d) => `- ${d}`).join('\n')}` : '\nAll required data collected — waiting for customer confirmation.'}

Your job: Extract order-related data from the customer's CURRENT message. Only extract what the customer actually said — do NOT decide when to create the order.

Use the "extract_order_data" action:
{ "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Pizza grande", "quantity": 2, "unitPrice": 850}], "deliveryType": "delivery", "address": "Av. Corrientes 1234", "neighborhood": "San Carlos", "deliveryCost": 5200, "deliveryNotes": "sin cebolla", "paymentMethod": "Nequi", "customerName": "Juan", "customerPhone": "3001234567", "estimatedTotal": 6900, "currency": "COP", "confirmed": true } }

Param "intent" is REQUIRED and must be one of: add_items, set_delivery_type, set_address, set_payment_method, confirm_order, cancel_order, modify_items, browse_menu, track_order, other.
All other params are optional — only include what the customer actually said in their message.

- "confirmed": set to true if customer said yes/confirms, false if they said no/reject
- "items": ONLY when the customer mentions NEW items in THIS message. Do NOT re-include items already in "Data collected so far" above.
- "deliveryType": only when customer says delivery or pickup
- "address": only when customer provides a delivery address
- "neighborhood": the barrio/neighborhood for delivery
- "deliveryCost": Look up the delivery cost from the business knowledge base when the customer provides a NEIGHBORHOOD (barrio). If the customer provides only a street address without mentioning the barrio, do NOT guess — set deliveryCost to null. NEVER say "voy a verificar" or "déjame confirmar con el equipo" about delivery costs.
- "paymentMethod": when customer specifies payment method (Efectivo, Nequi, Daviplata, Tarjeta)
- "customerName": when customer provides their name
- "customerPhone": when customer provides their phone number

CRITICAL: Only include data from the customer's CURRENT message. Do NOT repeat items or data that is already collected (shown above).
IMPORTANT: Include ALL data the customer provides in a single message — even if it covers multiple fields at once (e.g. items + address + payment). The backend can handle everything at once.

IMPORTANT: Do NOT use "create_order". The backend decides when the order is ready to be created.
IMPORTANT: Do NOT include a "send_menu_image" action while collecting order data — the customer is already ordering.`);
  } else if (orderFlow.state === OrderFlowState.ORDER_CREATED && orderFlow.activeOrderId) {
    const currentItems = orderFlow.items.map((i) => `${i.quantity}x ${i.name}${i.unitPrice ? ` ($${i.unitPrice})` : ''}${i.notes ? ` (${i.notes})` : ''}`).join(', ');
    sections.push(`## Active Order (Pending — Can Be Modified)
The customer already has a pending order (#${orderFlow.activeOrderId.slice(-6)}). Current items: ${currentItems || 'none'}.
Delivery: ${orderFlow.deliveryType ?? 'not set'} | Payment: ${orderFlow.paymentMethod ?? 'not set'}

If the customer wants to ADD items, CHANGE items, REMOVE items, or change delivery/payment details, use "extract_order_data" with the appropriate intent. The backend will UPDATE the existing order — it will NOT create a new one.

Examples:
- Customer says "agrega una Coca-Cola" → { "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Coca-Cola", "quantity": 1, "unitPrice": 5000}] } }
- Customer says "cambia la pizza por hawaiana" → { "type": "extract_order_data", "params": { "intent": "modify_items", "items": [{"name": "Pizza hawaiana", "quantity": 1, "unitPrice": 75000}] } }
- Customer says "quiero pagar con Nequi" → { "type": "extract_order_data", "params": { "intent": "set_payment_method", "paymentMethod": "Nequi" } }

Use "track_order" if the customer asks about order status.
Use "browse_menu" if they ask about the menu.

IMPORTANT: Do NOT use "create_order". The backend handles creation and updates automatically.`);
  } else {
    sections.push(`## Order Management
This business accepts orders. When the customer shows intent to order, use "extract_order_data" to capture their data. The backend manages the order flow.

{ "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Pizza mediana", "quantity": 1, "unitPrice": 48000}], "deliveryType": "delivery", "address": "Cra 5 #12-30", "neighborhood": "San Carlos", "deliveryCost": 5200, "paymentMethod": "Nequi", "customerName": "Juan", "estimatedTotal": 53200, "currency": "COP", "source": "conversation" } }

Param "intent" must be one of: add_items, set_delivery_type, set_address, set_payment_method, confirm_order, cancel_order, modify_items, browse_menu, track_order, other.
Include only the data the customer actually provided. Use "browse_menu" if the customer asks about the menu or products. Only include a "send_menu_image" action when the customer explicitly asks to VIEW the full menu — NOT when they ask a specific question about a product (sizes, prices, flavors, etc.).
Use "track_order" if the customer asks about the status of their order.

## Web Order Detection
If the customer's message begins with "Hola, quisiera realizar el siguiente pedido:" followed by a formatted list of items with prices and delivery data, this is an automated order from the website. You MUST extract ALL information in a SINGLE extract_order_data action:
- Parse ALL items with their prices as "items" array. Use unitPrice from the menu, not from the message.
- Extract pizza size and flavors from "Tamaño de pizza" and "Sabores elegidos" sections — put them in the item "notes" field.
- Extract delivery data: name → "customerName", phone → "customerPhone", address → "address", barrio → "neighborhood", medio de pago → "paymentMethod", comentarios → "deliveryNotes".
- Set "deliveryType" to "delivery" if there's address data, or "pickup" if it says "recoger en tienda".
- Set "source" to "web".
- Set "intent" to "add_items".
- Set "currency" to "COP".
Include ALL data at once so the backend can fast-track to confirmation.

IMPORTANT: Do NOT use "create_order". Always use "extract_order_data" — the backend decides when to create the order.`);
  }

  // Recurring customer defaults — as SUGGESTIONS, not pre-filled data
  if (lastOrderDefaults) {
    const defaultLines: string[] = [];
    if (lastOrderDefaults.deliveryAddress) defaultLines.push(`Last address: ${lastOrderDefaults.deliveryAddress}`);
    if (lastOrderDefaults.neighborhood) defaultLines.push(`Last neighborhood: ${lastOrderDefaults.neighborhood}`);
    if (lastOrderDefaults.paymentMethod) defaultLines.push(`Last payment method: ${lastOrderDefaults.paymentMethod}`);
    if (lastOrderDefaults.customerName) defaultLines.push(`Customer name: ${lastOrderDefaults.customerName}`);
    if (defaultLines.length > 0) {
      sections.push(`## Recurring Customer Data
This is a returning customer. Their previous order had these details:
${defaultLines.map((d) => `- ${d}`).join('\n')}

Suggest these to the customer when relevant (e.g. "¿Te lo envío a la misma dirección de la vez pasada?"). Only include them in your extract_order_data params if the customer CONFIRMS or explicitly provides them. Do NOT silently pre-fill these — always ask first.`);
    }
  }

  if (orders.length > 0) {
    const orderLines = orders.map((o) => {
      const itemList = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
      return `- Order #${o.id.slice(-6)} (${o.status}): ${itemList} | ${o.deliveryType}${o.deliveryAddress ? ` → ${o.deliveryAddress}` : ''}${o.neighborhood ? ` (${o.neighborhood})` : ''} | Total: ${o.estimatedTotal ?? 'N/A'} ${o.currency ?? ''} | Payment: ${o.paymentMethod ?? 'N/A'} | Created: ${o.createdAt.toISOString()}`;
    }).join('\n');
    sections.push(`## Existing Orders in This Conversation
These orders already exist. Do NOT create a new order with the same items. Only create a new order if the customer is ordering DIFFERENT items or explicitly says they want ANOTHER order.

${orderLines}`);
  }

  return sections;
}

export function buildOrderResponseSections(ctx: OrderPromptContext): string[] {
  const sections: string[] = [];

  if (ctx.orders.length > 0) {
    const statusMap: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      preparing: 'En preparación',
      ready: 'Listo',
      on_the_way: 'En camino',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
    };
    const orderLines = ctx.orders.map((o) => {
      const itemList = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
      return `- Order #${o.id.slice(-6)}: ${statusMap[o.status] ?? o.status} | ${itemList} | Total: ${o.estimatedTotal ?? 'N/A'} ${o.currency ?? ''}`;
    }).join('\n');
    sections.push(`## Customer Orders
Use this information to answer questions about the customer's orders. You know the status of their orders.

${orderLines}`);
  }

  return sections;
}

export function buildOrderFlowResponseDirective(
  directive: string,
  orderFlow: OrderFlowData,
): string {
  // After order creation: just pass the directive, no data dump.
  // The conversation history already has everything — let the AI read it naturally.
  if (orderFlow.state === OrderFlowState.ORDER_CREATED) {
    return `## Order Flow Instruction
${directive}

NEVER say the order is "ready", "lista", or "prepared" — it was only registered. You do not know the preparation status.`;
  }

  // While collecting: pass the directive (which asks about ONE specific thing)
  return `## Order Flow Instruction
${directive}

Only ask about ONE thing per message. Do not ask about multiple missing fields at once — the system will guide you to the next field after the customer responds.
NEVER say the order is "ready" or "lista" — you are still collecting information.
NEVER assume delivery type, payment method, address, or any data the customer has not explicitly provided.
Do NOT send the menu image while collecting order data.`;
}
