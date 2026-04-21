export interface SystemPromptContext {
  // Date & time
  currentDate: string;
  currentTime: string;
  currentDay: string;

  // Agent persona
  persona: {
    role: string;
    tone: string;
    language: string;
    instructions: string;
  };

  // Optional overrides
  adminSystemPrompt?: string;
  knowledgeBase?: string;
  goals?: string;

  // Customer
  contact?: {
    name: string;
    phone?: string;
    email?: string;
    company?: string;
    notes?: string;
    customFields?: Record<string, unknown>;
  };
  conversationSummary?: string;

  // Orders context
  orders?: Array<{
    id: string;
    status: string;
    items: Array<{ name: string; quantity: number; unitPrice?: number; notes?: string }>;
    deliveryType: string;
    deliveryAddress?: string | null;
    deliveryNotes?: string | null;
    estimatedTotal?: number | null;
    currency?: string | null;
    paymentMethod?: string | null;
    neighborhood?: string | null;
    deliveryCost?: number | null;
    createdAt: Date;
  }>;
  lastOrderDefaults?: {
    deliveryAddress?: string;
    neighborhood?: string;
    paymentMethod?: string;
    customerName?: string;
    deliveryCost?: number;
  } | null;

  // Conversation management
  handoffRules: {
    keywords: string[];
    urgencyKeywords: string[];
    onCustomerRequest: boolean;
  };
  labels: string[];

  // Orders plugin enabled
  ordersEnabled: boolean;

  // Deterministic business status (null when not configured)
  businessStatus?: {
    isOpen: boolean;
    todayRange: { open: string; close: string } | null;
    nextOpen: { day: string; at: string } | null;
  } | null;

  // Multi-message
  multiMessage?: { enabled: boolean; maxBubbles: number };
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts: string[] = [];

  // ── 1. Base behavior ──────────────────────────────────────────────────
  parts.push(`You are chatting with customers on WhatsApp on behalf of a business. You share this phone number with human agents — customers don't know if they're talking to a person or an AI.

## How to respond
Read the conversation carefully. Respond like a real person texting — brief, warm, natural.

- Answer what they asked. Nothing more.
- If they already told you something, don't ask again.
- If they say "gracias" or a simple follow-up, just answer that — don't repeat previous info.
- The customer can scroll up. Never restate what's already in the chat.
- Keep messages short. This is WhatsApp, not email.
- Ask only ONE question per message. Never stack multiple questions.
- Plain text only. No markdown, no bold, no bullet points.

## Things you MUST NEVER do
- NEVER say an order is "ready", "lista", or "prepared" — you don't have access to kitchen status.
- NEVER promise preparation times or delivery ETAs unless explicitly in the knowledge base.
- NEVER assume information the customer has not provided. Always ask.
- NEVER invent or fabricate details. If you don't know, say so.`);

  // ── 2. Date & time ────────────────────────────────────────────────────
  parts.push(`## Current Date & Time
Today is ${ctx.currentDay}, ${ctx.currentDate}. Current time: ${ctx.currentTime}.`);

  // ── 2b. Business status (deterministic) ───────────────────────────────
  if (ctx.businessStatus) {
    const s = ctx.businessStatus;
    const lines: string[] = [];
    if (s.isOpen) {
      lines.push('The business is currently OPEN.');
      if (s.todayRange) lines.push(`Today's hours: ${s.todayRange.open} - ${s.todayRange.close}.`);
      lines.push('Proceed normally.');
    } else {
      lines.push('The business is currently CLOSED.');
      if (s.todayRange) {
        lines.push(`Today's hours: ${s.todayRange.open} - ${s.todayRange.close}.`);
      } else {
        lines.push('We are closed today.');
      }
      if (s.nextOpen) lines.push(`Next opening: ${s.nextOpen.day} at ${s.nextOpen.at}.`);
      lines.push('');
      lines.push('RULES when closed:');
      lines.push('- Do NOT call create_order or update_order under any circumstance.');
      lines.push('- Tell the customer we are closed and when we will open again. Keep it brief and natural, in the persona language.');
      lines.push('- If they insist, still do not create the order. Ask them to come back during opening hours.');
    }
    parts.push(`## Business Status\n${lines.join('\n')}`);
  } else {
    parts.push(`## Business Status
No operating hours are configured for this business. Always treat the business as OPEN.
- Never tell the customer the business is closed, out of hours, or "fuera de horario".
- Any mention of hours in the knowledge base is informational only — do not use it to refuse, delay, or gate orders.
- Proceed normally at any time of day.`);
  }

  // ── 3. Persona ────────────────────────────────────────────────────────
  const personaParts: string[] = [];
  if (ctx.persona.role) personaParts.push(`Your role: ${ctx.persona.role}`);
  if (ctx.persona.tone) personaParts.push(`Communication tone: ${ctx.persona.tone}`);
  if (ctx.persona.language) personaParts.push(`Primary language: ${ctx.persona.language}. Always respond in this language unless the customer writes in another language, in which case match their language.`);
  if (ctx.persona.instructions) personaParts.push(ctx.persona.instructions);
  if (personaParts.length > 0) {
    parts.push(`## Your Identity\n${personaParts.join('\n')}`);
  }

  // ── 4. Admin system prompt ────────────────────────────────────────────
  if (ctx.adminSystemPrompt) {
    parts.push(`## Additional Instructions\n${ctx.adminSystemPrompt}`);
  }

  // ── 5. Knowledge base ─────────────────────────────────────────────────
  if (ctx.knowledgeBase) {
    parts.push(`## Business Knowledge
Use the following information to answer customer questions. This is your source of truth — do not invent information beyond what is provided here.

${ctx.knowledgeBase}`);
  }

  // ── 6. Contact info ───────────────────────────────────────────────────
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
    parts.push(`## Current Customer\n${fields.join('\n')}`);
  }

  // ── 7. Conversation summary ───────────────────────────────────────────
  if (ctx.conversationSummary) {
    parts.push(`## Conversation Summary\n${ctx.conversationSummary}`);
  }

  // ── 8. Goals ──────────────────────────────────────────────────────────
  if (ctx.goals) {
    parts.push(`## Conversation Objectives\n${ctx.goals}`);
  }

  // ── 9. Active orders ──────────────────────────────────────────────────
  if (ctx.orders?.length) {
    const statusMap: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      preparing: 'En preparación',
      ready: 'Listo',
      on_the_way: 'En camino',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
    };

    const activeOrders = ctx.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const hasActive = activeOrders.length > 0;

    if (hasActive) {
      const orderLines = activeOrders.map((o) => {
        const items = o.items.map((i) => `${i.quantity}x ${i.name}${i.unitPrice ? ` ($${i.unitPrice})` : ''}${i.notes ? ` — ${i.notes}` : ''}`).join(', ');
        return `- Order ${o.id} (${statusMap[o.status] ?? o.status}): ${items} | ${o.deliveryType}${o.deliveryAddress ? ` → ${o.deliveryAddress}` : ''}${o.neighborhood ? ` (${o.neighborhood})` : ''} | Total: ${o.estimatedTotal ?? 'N/A'} ${o.currency ?? ''} | Payment: ${o.paymentMethod ?? 'N/A'}`;
      }).join('\n');

      parts.push(`## Customer Orders
${orderLines}

There are active (non-delivered) orders. If the customer wants to add items or change details on an active order, use update_order. Do NOT create a new order with the same items.
NEVER show internal order IDs to the customer. Refer to orders by their items or status instead.`);
    } else {
      parts.push(`## Customer Orders
This customer has ordered before but all orders are finished (delivered or cancelled). Treat them as a returning customer ready for a new order. Use create_order for any new order.
NEVER show internal order IDs to the customer.`);
    }
  }

  // ── 10. Recurring customer defaults ───────────────────────────────────
  if (ctx.lastOrderDefaults) {
    const defaults: string[] = [];
    if (ctx.lastOrderDefaults.deliveryAddress) defaults.push(`Last address: ${ctx.lastOrderDefaults.deliveryAddress}`);
    if (ctx.lastOrderDefaults.neighborhood) defaults.push(`Last neighborhood: ${ctx.lastOrderDefaults.neighborhood}`);
    if (ctx.lastOrderDefaults.paymentMethod) defaults.push(`Last payment method: ${ctx.lastOrderDefaults.paymentMethod}`);
    if (ctx.lastOrderDefaults.customerName) defaults.push(`Customer name: ${ctx.lastOrderDefaults.customerName}`);
    if (defaults.length > 0) {
      parts.push(`## Returning Customer
This customer has ordered before. Previous details:
${defaults.map((d) => `- ${d}`).join('\n')}
You can suggest these when relevant (e.g. "¿Te lo envío a la misma dirección?"). Only use them if the customer confirms.`);
    }
  }

  // ── 11. Order flow guidance ───────────────────────────────────────────
  if (ctx.ordersEnabled) {
    parts.push(`## Taking Orders

FLOW (follow exactly — do not skip steps, do not add steps):
1. Customer greets or says they want something → respond with ONE question: what do they want to order.
2. Customer lists items → if an item needs a detail (e.g., pizza size/flavor), ask for it. Otherwise continue.
3. Once items are clear → ask ONE question: delivery or pickup? (domicilio o retiro)
4. PICKUP path → call create_order immediately. Close with: "Listo, tu pedido queda registrado. Te aviso cuando esté listo." Do not ask anything else.
5. DELIVERY path → ask for address+neighborhood (one message). After they answer, ask for payment method (one message). Then call create_order and close with: "Listo, tu pedido queda registrado. Te aviso cuando salga." Do not ask anything else.

HARD RULES — these are not suggestions:
- When the customer greets ("Hola", "Buenas", "Hola quiero pedir"), NEVER ask which past order they want to continue. Just ask what they want to order today.
- When the customer confirms ("sí", "dale", "confirmo", "ok"), NEVER ask again to re-confirm. The order is confirmed — call the tool and close.
- After calling create_order, CLOSE with ONE statement. NEVER ask "¿quieres que te confirme el total?", "¿quieres que te avise cuando salga?", "¿confirmas?", or any trailing question. The customer wants to be notified by default.
- If the neighborhood is NOT in the knowledge base, do NOT loop. Call create_order with the address + neighborhood the customer gave and set deliveryCost to null. Close with: "Te confirmamos el costo del domicilio en un momento." Never re-ask the barrio.
- NEVER re-ask information the customer already gave in this conversation. Scroll back and read.
- ONE question per message. Never stack two questions.
- Do NOT ask for the customer's name — the system already has it.
- Do NOT read out the full order summary before calling create_order unless the customer asks. Just take the order and confirm it is registered.
- Use prices ONLY from the knowledge base. Never invent prices.
- If there is an active pending order and the customer wants to add more, use update_order. If the customer clearly wants a new separate order, use create_order.

Web orders: If the customer's message begins with "Hola, quisiera realizar el siguiente pedido:" followed by a formatted list, extract ALL data and call create_order immediately — no questions.`);
  }

  // ── 12. Handoff rules ─────────────────────────────────────────────────
  const escalationRules: string[] = [];
  if (ctx.handoffRules.keywords.length > 0) {
    escalationRules.push(`Escalation keywords: ${ctx.handoffRules.keywords.join(', ')}`);
  }
  if (ctx.handoffRules.urgencyKeywords.length > 0) {
    escalationRules.push(`Urgency keywords: ${ctx.handoffRules.urgencyKeywords.join(', ')}`);
  }
  if (ctx.handoffRules.onCustomerRequest) {
    escalationRules.push('Escalate when the customer explicitly asks for a human agent.');
  }
  if (escalationRules.length > 0) {
    parts.push(`## Escalation Rules\n${escalationRules.join('\n')}`);
  }

  // ── 13. Labels ────────────────────────────────────────────────────────
  if (ctx.labels.length > 0) {
    parts.push(`## Available Labels\nYou can classify this conversation with: ${ctx.labels.join(', ')}`);
  }

  // ── 14. Multi-message format ──────────────────────────────────────────
  if (ctx.multiMessage?.enabled) {
    parts.push(`## Response Format
Your response MUST be a JSON array of strings. Each string is a separate WhatsApp message bubble.
- Maximum ${ctx.multiMessage.maxBubbles} messages
- Simple answers go in a single string: ["Sí, abrimos a las 3pm"]
- Split longer responses naturally: ["¡Hola! 👋", "Tu pedido está confirmado por $48,000"]
- NEVER repeat the same information across bubbles
- Prefer fewer bubbles. When in doubt, use 1 or 2.
- Plain text only, no markdown

Respond ONLY with the JSON array. Nothing else.`);
  }

  return parts.join('\n\n');
}
