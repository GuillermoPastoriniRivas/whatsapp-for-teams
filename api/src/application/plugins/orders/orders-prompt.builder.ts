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

      if (orderFlow.neighborhood) collectedData.push(`Neighborhood: ${orderFlow.neighborhood}`);

      if (orderFlow.paymentMethod) {
        collectedData.push(`Payment method: ${orderFlow.paymentMethod}`);
      } else {
        missingData.push('Payment method');
      }
    } else if (orderFlow.deliveryType === 'pickup') {
      // Pickup: no address, neighborhood, or payment method needed
      if (orderFlow.paymentMethod) collectedData.push(`Payment method: ${orderFlow.paymentMethod}`);
    } else {
      // Delivery type not set yet — do NOT show address/payment as missing
      // They will be asked AFTER the customer chooses delivery or pickup
    }

    if (orderFlow.deliveryNotes) collectedData.push(`Notes: ${orderFlow.deliveryNotes}`);

    if (orderFlow.deliveryCost !== null) collectedData.push(`Delivery cost: $${orderFlow.deliveryCost}`);
    if (orderFlow.estimatedTotal !== null) collectedData.push(`Total: $${orderFlow.estimatedTotal} ${orderFlow.currency ?? ''}`);

    sections.push(`## Order Flow (Active)
${collectedData.length > 0 ? `Data collected so far:\n${collectedData.map((d) => `- ${d}`).join('\n')}` : 'No data collected yet.'}
${missingData.length > 0 ? `\nStill needed (for your reference — extract these IF the customer mentions them, but do NOT ask about all of them at once):\n${missingData.map((d) => `- ${d}`).join('\n')}` : '\nAll required data collected — waiting for customer confirmation.'}

CONVERSATION FLOW (follow this exact sequence, ONE step per message):
1. Help the customer choose what to order (show menu options, sizes, flavors)
2. Once items are decided, ask: delivery or pickup?
3. If DELIVERY → ask for address and neighborhood, then payment method
4. If PICKUP → tell them estimated wait time (from knowledge base)
5. Confirm the order summary and register it
NEVER skip ahead. NEVER ask about delivery/pickup, address, or payment before the items are decided. NEVER ask about payment unless it's delivery.
The responseHint must address ONLY the current step — do NOT mention future steps like delivery, payment, or confirmation.

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
  } else if (orderFlow.state === OrderFlowState.ORDER_CREATED && orderFlow.activeOrderId && (() => {
    const activeOrder = orders.find((o) => o.id === orderFlow.activeOrderId);
    return activeOrder && !['delivered', 'cancelled'].includes(activeOrder.status);
  })()) {
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
    const finishedStatuses = ['delivered', 'cancelled'];
    const hasActiveOrders = orders.some((o) => !finishedStatuses.includes(o.status));

    sections.push(`## Existing Orders in This Conversation
${orderLines}

${hasActiveOrders
  ? 'There are active (non-delivered) orders above. Do NOT create a new order with the same items unless the customer explicitly asks for ANOTHER order.'
  : 'All orders above are finished (delivered or cancelled). If the customer wants to order again, treat it as a NEW order — do NOT try to modify a delivered/cancelled order.'}`);
  }

  return sections;
}

export function buildOrderResponseSections(ctx: OrderPromptContext): string[] {
  const sections: string[] = [];

  // When idle (no active order flow), guide the bot to present itself as the business
  if (ctx.orderFlow.state === OrderFlowState.IDLE) {
    sections.push(`## Greeting Guidance
When a customer greets you or starts a conversation, introduce yourself briefly as the business (use your identity from the persona section) and offer to help with their order or show the menu. Example: "¡Hola! Bienvenido a [business name], ¿te gustaría hacer un pedido? También puedo enviarte nuestro menú." Keep it short and warm — ONE message, ONE or two sentences.`);
  }

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

NEVER say the order is "ready", "lista", or "prepared" — it was only registered. You do not know the preparation status.
After confirming the order, do NOT ask unnecessary follow-up questions (e.g. "¿quieres que te avise cuando esté en camino?"). Instead, close the conversation naturally: "Te aviso en cuanto esté listo" or similar. The customer does not need to respond further.`;
  }

  // While collecting: pass the directive (which asks about ONE specific thing)
  return `## Order Flow Instruction
${directive}

CRITICAL RULES FOR THIS RESPONSE:
1. Send exactly ONE short message with ONE question — the one described above.
2. Do NOT add a second question, a follow-up, or ask about any other topic.
3. Do NOT split your response into multiple messages or bubbles.

BAD (do NOT do this):
"¡Hola! ¿Qué te gustaría pedir?"
"¿Es para domicilio o recoger en tienda? ¿Qué medio de pago usarás?"
← This asks THREE things. WRONG.

GOOD:
"¡Hola! ¿Qué te gustaría pedir?"
← ONE question only. The system will ask about delivery AFTER they answer.

NEVER say the order is "ready" or "lista" — you are still collecting information.
NEVER assume delivery type, payment method, address, or any data the customer has not explicitly provided.
NEVER ask about payment method unless the customer chose delivery.
Do NOT send the menu image while collecting order data.`;
}
