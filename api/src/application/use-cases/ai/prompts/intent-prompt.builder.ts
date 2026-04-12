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
  handoffRules: {
    keywords: string[];
    urgencyKeywords: string[];
    onCustomerRequest: boolean;
  };
  pluginSections: string[];
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

  // Plugin-contributed sections
  if (ctx.pluginSections.length > 0) {
    parts.push(...ctx.pluginSections);
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
  "responseHint": "ONE specific thing the response should address — must be a single question or statement, NEVER combine two topics (e.g. WRONG: 'ask what they want and if it is delivery or pickup')"
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

**send_menu_image** - Attach the menu image to the response. ONLY use when the customer explicitly asks to SEE or VIEW the full menu (e.g., "quiero ver el menú", "muéstrame la carta", "qué tienen", "pásame el menú"). Do NOT use when the customer asks a SPECIFIC question about a product (e.g., "de cuántos sabores puedo pedir?", "cuánto cuesta la familiar?", "qué ingredientes tiene?") — answer those from the knowledge base instead. Do NOT use when the customer is already in the middle of placing an order.
{ "type": "send_menu_image", "params": {} }

**escalate** - Transfer to human agent:
{ "type": "escalate", "params": { "reason": "Customer frustrated with delivery delay" } }

**extract_order_data** - Extract order-related data from the customer's message. The backend controls the order flow — do NOT use create_order.
{ "type": "extract_order_data", "params": { "intent": "add_items", "items": [{"name": "Pizza grande", "quantity": 2, "unitPrice": 850}], "deliveryType": "delivery", "address": "Av. Corrientes 1234", "neighborhood": "San Carlos", "deliveryCost": 5200, "paymentMethod": "Nequi", "deliveryNotes": "sin cebolla", "estimatedTotal": 6900, "currency": "COP" } }

### Rules:
- ALWAYS include MULTIPLE actions when applicable. For example, if the customer says "soy Juan, quiero una pizza" you MUST include BOTH update_contact (name=Juan) AND any other relevant action. Never skip update_contact just because there is another primary action.
- ALWAYS emit update_contact when the customer shares personal info (name, email, address, etc.) — even if the main intent is something else like creating an order.
- If no actions are needed (pure conversation), return an empty actions array
- "responseHint" must be ONE short sentence about the single most important thing to address in the response. Do NOT list multiple questions or topics — the system handles the conversation flow step by step. WRONG: "ask about items and delivery type". CORRECT: "ask what items they want to order"
- Set confidence between 0.0 and 1.0 based on how certain you are about the intent
- For "update_contact": ONLY extract data from messages with role "user" (the customer). NEVER use information from "assistant" messages (your own responses) to update contact data. For example, if YOU mentioned a business address, do NOT save it as the customer's address. Use "custom.direccion" for physical addresses.
- For "extract_order_data": always include the "intent" param. Only include other params that the customer explicitly mentioned. Do NOT use "create_order" — the backend creates orders automatically when data is complete.
- For "extract_order_data": ALWAYS include "unitPrice" for each item, using prices from the business knowledge base. This is critical for total calculation.
- For "extract_order_data": When the customer provides a neighborhood/barrio that matches the knowledge base, look up and include "deliveryCost". If the customer gives only a street address without a recognizable barrio, include the address but omit deliveryCost — the system will ask for the barrio. NEVER say you need to "verify" or "check" the delivery cost.
- For "escalate": takes priority over all other actions

REMEMBER: Output ONLY a JSON object. Do NOT write any text, conversation, or explanation. Just JSON.`);

  return parts.join('\n\n');
}
