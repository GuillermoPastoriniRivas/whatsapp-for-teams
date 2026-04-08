import { PhoneNumberPlugin } from '../../../../domain/enums/phone-number-plugin.enum.js';

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
  }>;
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
    parts.push(`## Order Management
This business accepts orders. When the customer specifies what they want to order, include a "create_order" action with items, type (delivery/pickup), address, total, and currency.
Do NOT ask for excessive confirmations. If the customer says what they want and where to deliver, that IS the order — create it directly.`);

    if (ctx.orders && ctx.orders.length > 0) {
      const orderLines = ctx.orders.map((o) => {
        const itemList = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
        return `- Order #${o.id.slice(-6)} (${o.status}): ${itemList} | ${o.deliveryType}${o.deliveryAddress ? ` → ${o.deliveryAddress}` : ''} | Total: ${o.estimatedTotal ?? 'N/A'} ${o.currency ?? ''} | Created: ${o.createdAt.toISOString()}`;
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

**create_order** - Create an order (only after customer confirms):
{ "type": "create_order", "params": { "items": [{"name": "Pizza grande", "quantity": 2, "unitPrice": 850}], "type": "delivery", "address": "Av. Corrientes 1234", "notes": "sin cebolla", "total": 1700, "currency": "ARS" } }

### Rules:
- ALWAYS include MULTIPLE actions when applicable. For example, if the customer says "soy Juan, quiero una pizza" you MUST include BOTH update_contact (name=Juan) AND any other relevant action. Never skip update_contact just because there is another primary action.
- ALWAYS emit update_contact when the customer shares personal info (name, email, address, etc.) — even if the main intent is something else like creating an order.
- If no actions are needed (pure conversation), return an empty actions array
- "responseHint" tells the response generator what tone/content to use
- Set confidence between 0.0 and 1.0 based on how certain you are about the intent
- For "update_contact": ONLY extract data from messages with role "user" (the customer). NEVER use information from "assistant" messages (your own responses) to update contact data. For example, if YOU mentioned a business address, do NOT save it as the customer's address. Use "custom.direccion" for physical addresses.
- For "create_order": only after explicit confirmation from the customer
- For "escalate": takes priority over all other actions

REMEMBER: Output ONLY a JSON object. Do NOT write any text, conversation, or explanation. Just JSON.`);

  return parts.join('\n\n');
}
