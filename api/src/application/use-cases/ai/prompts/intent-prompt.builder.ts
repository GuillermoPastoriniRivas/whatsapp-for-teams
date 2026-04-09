import { PhoneNumberPlugin } from '../../../../domain/enums/phone-number-plugin.enum.js';
import { OrderFlowState } from '../../../../domain/enums/order-flow-state.enum.js';
import type { OrderFlowData } from '../../../../domain/value-objects/order-flow.types.js';

export interface IntentPromptContext {
  currentDate: string;
  currentTime: string;
  currentDay: string;
  contact?: {
    name: string;
    phone?: string;
    email?: string;
    company?: string;
    notes?: string;
    customFields?: Record<string, unknown>;
  };
  conversationSummary?: string;
  knowledgeBase?: string;
  goals?: string;
  labels: string[];
  phonePlugins: PhoneNumberPlugin[];
  handoffRules: {
    keywords: string[];
    urgencyKeywords: string[];
    onCustomerRequest: boolean;
  };
  orders?: Array<{
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
  orderFlow?: OrderFlowData | null;
  lastOrderDefaults?: {
    deliveryAddress?: string;
    neighborhood?: string;
    paymentMethod?: string;
    customerName?: string;
  } | null;
}

export function buildIntentPrompt(ctx: IntentPromptContext): string {
  const parts: string[] = [];

  parts.push(`CRITICAL: You are a JSON-only intent analyzer. You MUST output ONLY a raw JSON object. NO natural language, NO conversation, NO greetings, NO markdown fences. Just a single JSON object starting with { and ending with }.

Your job: analyze the customer's last message and decide what intent it has and what actions to take. Output your analysis as JSON.`);

  // Date & time
  parts.push(`## Current Date & Time
Today is ${ctx.currentDay}, ${ctx.currentDate}. Current time: ${ctx.currentTime}.`);

  // Contact info (so the model knows what data is already collected)
  if (ctx.contact) {
    const fields: string[] = [`Name: ${ctx.contact.name}`];
    if (ctx.contact.phone) fields.push(`Phone: ${ctx.contact.phone}`);
    if (ctx.contact.email) fields.push(`Email: ${ctx.contact.email}`);
    if (ctx.contact.company) fields.push(`Company: ${ctx.contact.company}`);
    if (ctx.contact.notes) fields.push(`Notes: ${ctx.contact.notes}`);
    if (ctx.contact.customFields) {
      for (const [key, value] of Object.entries(ctx.contact.customFields)) {
        fields.push(`${key}: ${value}`);
      }
    }
    parts.push(`## Current Customer Data (already collected)
${fields.join('\n')}`);
  }

  // Conversation summary
  if (ctx.conversationSummary) {
    parts.push(`## Conversation Summary
${ctx.conversationSummary}`);
  }

  // Knowledge base
  if (ctx.knowledgeBase) {
    parts.push(`## Business Knowledge
Use this to determine if you can answer the customer's question.

${ctx.knowledgeBase}`);
  }

  // Goals
  if (ctx.goals) {
    parts.push(`## Conversation Objectives
These are the goals for this conversation. If one is achieved, include a "complete_goal" action.

${ctx.goals}`);
  }

  // Labels
  if (ctx.labels.length > 0) {
    parts.push(`## Available Labels
You can classify the conversation with these labels: ${ctx.labels.join(', ')}`);
  }

  // Orders plugin
  if (ctx.phonePlugins.includes(PhoneNumberPlugin.ORDERS)) {
    const flowActive = ctx.orderFlow && ctx.orderFlow.state !== OrderFlowState.IDLE && ctx.orderFlow.state !== OrderFlowState.ORDER_CREATED;

    if (flowActive && ctx.orderFlow) {
      // State machine is active — LLM extracts data, backend controls flow
      const flow = ctx.orderFlow;
      const collectedData: string[] = [];
      if (flow.items.length > 0) {
        collectedData.push(`Items: ${flow.items.map((i) => `${i.quantity}x ${i.name}${i.unitPrice ? ` ($${i.unitPrice})` : ''}${i.notes ? ` (${i.notes})` : ''}`).join(', ')}`);
      }
      if (flow.deliveryType) collectedData.push(`Delivery type: ${flow.deliveryType}`);
      if (flow.deliveryAddress) collectedData.push(`Address: ${flow.deliveryAddress}`);
      if (flow.neighborhood) collectedData.push(`Neighborhood: ${flow.neighborhood}`);
      if (flow.deliveryNotes) collectedData.push(`Notes: ${flow.deliveryNotes}`);
      if (flow.paymentMethod) collectedData.push(`Payment method: ${flow.paymentMethod}`);
      if (flow.deliveryCost !== null) collectedData.push(`Delivery cost: $${flow.deliveryCost}`);
      if (flow.estimatedTotal !== null) collectedData.push(`Total: $${flow.estimatedTotal} ${flow.currency ?? ''}`);

      parts.push(`## Order Flow (State Machine Active)
Current state: ${flow.state}
${collectedData.length > 0 ? `Data collected so far:\n${collectedData.map((d) => `- ${d}`).join('\n')}` : 'No data collected yet.'}

Your job: Extract order-related data from the customer's message. Do NOT decide when to create the order — the backend controls the flow.

Use the "extract_order_data" action:
{ "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Pizza grande", "quantity": 2, "unitPrice": 850}], "deliveryType": "delivery", "address": "Av. Corrientes 1234", "neighborhood": "San Carlos", "deliveryNotes": "sin cebolla", "paymentMethod": "Nequi", "customerName": "Juan", "customerPhone": "3001234567", "estimatedTotal": 1700, "currency": "COP", "confirmed": true } }

Param "intent" is REQUIRED and must be one of: add_items, set_delivery_type, set_address, set_payment_method, confirm_order, cancel_order, modify_items, browse_menu, track_order, other.
All other params are optional — only include what the customer actually said in their message.

- "confirmed": set to true if customer said yes/confirms, false if they said no/reject
- "items": only when customer mentions specific products. ALWAYS include unitPrice from the menu.
- "deliveryType": only when customer says delivery or pickup
- "address": only when customer provides a delivery address
- "neighborhood": the barrio/neighborhood for delivery cost calculation
- "paymentMethod": when customer specifies payment method (Efectivo, Nequi, Daviplata, Tarjeta)
- "customerName": when customer provides their name
- "customerPhone": when customer provides their phone number

IMPORTANT: Do NOT use "create_order". The backend decides when the order is ready to be created.`);
    } else {
      // No active flow — show standard order management + extract_order_data for starting flows
      parts.push(`## Order Management
This business accepts orders. When the customer shows intent to order, use "extract_order_data" to capture their data. The backend manages the order flow.

{ "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Pizza mediana", "quantity": 1, "unitPrice": 48000}], "deliveryType": "delivery", "address": "Cra 5 #12-30", "neighborhood": "San Carlos", "paymentMethod": "Nequi", "customerName": "Juan", "estimatedTotal": 48000, "currency": "COP", "source": "conversation" } }

Param "intent" must be one of: add_items, set_delivery_type, set_address, set_payment_method, confirm_order, cancel_order, modify_items, browse_menu, track_order, other.
Include only the data the customer actually provided. Use "browse_menu" if the customer wants to see what's available.
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

    // Recurring customer defaults
    if (ctx.lastOrderDefaults) {
      const defaults = ctx.lastOrderDefaults;
      const defaultLines: string[] = [];
      if (defaults.deliveryAddress) defaultLines.push(`Last address: ${defaults.deliveryAddress}`);
      if (defaults.neighborhood) defaultLines.push(`Last neighborhood: ${defaults.neighborhood}`);
      if (defaults.paymentMethod) defaultLines.push(`Last payment method: ${defaults.paymentMethod}`);
      if (defaults.customerName) defaultLines.push(`Customer name: ${defaults.customerName}`);
      if (defaultLines.length > 0) {
        parts.push(`## Recurring Customer Data
This is a returning customer. Their last order had these details:
${defaultLines.map((d) => `- ${d}`).join('\n')}

If the customer provides items but doesn't mention delivery details or payment, you can STILL include these defaults in your extract_order_data params so the backend can pre-fill the order. The response LLM will suggest these to the customer for confirmation.`);
      }
    }

    if (ctx.orders && ctx.orders.length > 0) {
      const orderLines = ctx.orders.map((o) => {
        const itemList = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
        return `- Order #${o.id.slice(-6)} (${o.status}): ${itemList} | ${o.deliveryType}${o.deliveryAddress ? ` → ${o.deliveryAddress}` : ''}${o.neighborhood ? ` (${o.neighborhood})` : ''} | Total: ${o.estimatedTotal ?? 'N/A'} ${o.currency ?? ''} | Payment: ${o.paymentMethod ?? 'N/A'} | Created: ${o.createdAt.toISOString()}`;
      }).join('\n');
      parts.push(`## Existing Orders in This Conversation
These orders already exist. Do NOT create a new order with the same items. Only create a new order if the customer is ordering DIFFERENT items or explicitly says they want ANOTHER order.

${orderLines}`);
    }
  }

  // Escalation rules
  const escalationRules: string[] = [];
  if (ctx.handoffRules.keywords.length > 0) {
    escalationRules.push(`Escalation keywords: ${ctx.handoffRules.keywords.join(', ')}`);
  }
  if (ctx.handoffRules.urgencyKeywords.length > 0) {
    escalationRules.push(`Urgency keywords: ${ctx.handoffRules.urgencyKeywords.join(', ')}`);
  }
  if (ctx.handoffRules.onCustomerRequest) {
    escalationRules.push(`Escalate when the customer explicitly asks for a human agent.`);
  }
  escalationRules.push(`Escalate when: customer is frustrated, question is outside knowledge base, complex issue needs human judgment, high-value opportunity.`);
  parts.push(`## Escalation Rules
${escalationRules.join('\n')}`);

  // JSON schema with examples
  parts.push(`## Response Format

Respond with a JSON object with this exact structure:

{
  "intent": "brief description of what the customer wants",
  "confidence": 0.95,
  "actions": [],
  "responseHint": "brief guidance for generating the response"
}

### Available action types:

**update_contact** - Save customer info learned during conversation (only data explicitly provided by the customer):
{ "type": "update_contact", "params": { "field": "name", "value": "Juan Perez" } }
{ "type": "update_contact", "params": { "field": "email", "value": "juan@mail.com" } }
{ "type": "update_contact", "params": { "field": "company", "value": "Acme" } }
{ "type": "update_contact", "params": { "field": "notes", "value": "Interested in catering" } }
{ "type": "update_contact", "params": { "field": "custom.direccion", "value": "Av. Corrientes 1234" } }

**add_label** / **remove_label** - Classify conversation:
{ "type": "add_label", "params": { "label": "ventas" } }
{ "type": "remove_label", "params": { "label": "soporte" } }

**update_summary** - Keep conversation summary updated after substantive exchanges:
{ "type": "update_summary", "params": { "summary": "Customer asking about catering for 50 people on Saturday" } }

**complete_goal** - When a conversation objective is achieved:
{ "type": "complete_goal", "params": { "goal": "lead_qualified" } }

**escalate** - Transfer to human agent:
{ "type": "escalate", "params": { "reason": "Customer frustrated with delivery delay" } }

**extract_order_data** - Extract order-related data from the customer's message. The backend controls the order flow — do NOT use create_order.
{ "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Pizza grande", "quantity": 2, "unitPrice": 850}], "deliveryType": "delivery", "address": "Av. Corrientes 1234", "neighborhood": "San Carlos", "paymentMethod": "Nequi", "deliveryNotes": "sin cebolla", "estimatedTotal": 1700, "currency": "COP" } }

### Rules:
- ALWAYS include MULTIPLE actions when applicable. For example, if the customer says "soy Juan, quiero una pizza" you MUST include BOTH update_contact (name=Juan) AND any other relevant action. Never skip update_contact just because there is another primary action.
- ALWAYS emit update_contact when the customer shares personal info (name, email, address, etc.) — even if the main intent is something else like creating an order.
- If no actions are needed (pure conversation), return an empty actions array
- "responseHint" tells the response generator what tone/content to use
- Set confidence between 0.0 and 1.0 based on how certain you are about the intent
- For "update_contact": ONLY extract data from messages with role "user" (the customer). NEVER use information from "assistant" messages (your own responses) to update contact data. For example, if YOU mentioned a business address, do NOT save it as the customer's address. Use "custom.direccion" for physical addresses.
- For "extract_order_data": always include the "intent" param. Only include other params that the customer explicitly mentioned. Do NOT use "create_order" — the backend creates orders automatically when data is complete.
- For "extract_order_data": ALWAYS include "unitPrice" for each item, using prices from the business knowledge base. This is critical for total calculation.
- For "escalate": takes priority over all other actions

REMEMBER: Output ONLY a JSON object. Do NOT write any text, conversation, or explanation. Just JSON.`);

  return parts.join('\n\n');
}
