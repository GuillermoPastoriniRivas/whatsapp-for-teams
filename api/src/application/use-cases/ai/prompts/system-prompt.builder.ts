import type { BusinessProfile, BotBehavior } from '../../../../domain/entities/ai-agent-config.entity.js';
import { getVerticalTemplate } from './vertical-templates.js';

export interface SystemPromptContext {
  // Date & time
  currentDate: string;
  currentTime: string;
  currentDay: string;

  // What the business owner configured
  businessProfile: BusinessProfile;
  behavior: BotBehavior;

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

  // Conversation management
  handoffRules: {
    keywords: string[];
    urgencyKeywords: string[];
    onCustomerRequest: boolean;
  };
  labels: string[];

  // Deterministic business status (null when not configured)
  businessStatus?: {
    isOpen: boolean;
    todayRange: { open: string; close: string } | null;
    nextOpen: { day: string; at: string } | null;
  } | null;

  // Multi-message
  multiMessage?: { enabled: boolean; maxBubbles: number };
}

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish (Latin American)',
  en: 'English',
  pt: 'Portuguese (Brazilian)',
};

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts: string[] = [];
  const profile = ctx.businessProfile;
  const behavior = ctx.behavior;
  const template = getVerticalTemplate(profile.vertical);

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
- NEVER promise timelines or commitments unless explicitly in the business information.
- NEVER assume information the customer has not provided. Always ask.
- NEVER invent or fabricate details (prices, products, services, policies). If it's not in the business information, say you'll check with the team.`);

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
      lines.push('- Tell the customer we are closed and when we will open again. Keep it brief and natural.');
      lines.push('- If they insist, ask them to come back during opening hours.');
    }
    parts.push(`## Business Status\n${lines.join('\n')}`);
  } else {
    parts.push(`## Business Status
No operating hours are configured for this business. Always treat the business as OPEN.
- Never tell the customer the business is closed, out of hours, or "fuera de horario".
- Any mention of hours in the business information is informational only — do not use it to refuse or delay requests.
- Proceed normally at any time of day.`);
  }

  // ── 3. Identity ───────────────────────────────────────────────────────
  const identity: string[] = [];
  identity.push(`You are the WhatsApp assistant for "${profile.businessName}", ${template.businessKind}.`);
  if (profile.description) identity.push(`About the business: ${profile.description}`);
  parts.push(`## Your Identity\n${identity.join('\n')}`);

  // ── 4. Communication style ────────────────────────────────────────────
  const style: string[] = [];
  const langName = LANGUAGE_NAMES[behavior.language] ?? behavior.language;
  style.push(`- Respond in ${langName}, unless the customer writes in another language — then match their language.`);
  if (behavior.formality === 'formal') {
    style.push('- Address the customer formally (in Spanish: "usted").');
  } else {
    style.push('- Address the customer informally and warmly (in Spanish: use the natural informal treatment of the region, "vos"/"tú").');
  }
  if (behavior.useEmojis) {
    style.push('- You may use at most one emoji per message, occasionally, where it feels natural. Never more.');
  } else {
    style.push('- Do not use emojis.');
  }
  parts.push(`## Communication Style\n${style.join('\n')}`);

  // ── 5. Vertical playbook ──────────────────────────────────────────────
  parts.push(`## How This Business Works\n${template.instructions}`);

  // ── 6. Business information ───────────────────────────────────────────
  const info: string[] = [];
  if (profile.address) info.push(`Address: ${profile.address}`);
  if (profile.paymentMethods) info.push(`Payment methods: ${profile.paymentMethods}`);
  if (profile.catalog.length > 0) {
    const items = profile.catalog.map((item) => {
      let line = `- ${item.name}`;
      if (item.price) line += `: ${item.price}`;
      if (item.description) line += ` (${item.description})`;
      return line;
    });
    info.push(`\n### ${template.catalogLabel}\n${items.join('\n')}`);
  }
  if (profile.faqs.length > 0) {
    const faqs = profile.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`);
    info.push(`\n### Frequently Asked Questions\n${faqs.join('\n\n')}`);
  }
  if (profile.extraNotes) {
    info.push(`\n### Additional Notes\n${profile.extraNotes}`);
  }
  if (info.length > 0) {
    parts.push(`## Business Information
This is your source of truth. Answer only from this information — do not invent anything beyond it.

${info.join('\n')}`);
  }

  // ── 7. Conversation objective ─────────────────────────────────────────
  if (behavior.goal) {
    parts.push(`## Conversation Objective\n${behavior.goal}`);
  }

  // ── 8. Custom instructions (owner escape hatch) ───────────────────────
  if (behavior.customInstructions) {
    parts.push(`## Additional Instructions\n${behavior.customInstructions}`);
  }

  // ── 9. Contact info ───────────────────────────────────────────────────
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

  // ── 10. Conversation summary ──────────────────────────────────────────
  if (ctx.conversationSummary) {
    parts.push(`## Conversation Summary\n${ctx.conversationSummary}`);
  }

  // ── 11. Handoff rules ─────────────────────────────────────────────────
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

  // ── 12. Labels ────────────────────────────────────────────────────────
  if (ctx.labels.length > 0) {
    parts.push(`## Available Labels\nYou can classify this conversation with: ${ctx.labels.join(', ')}`);
  }

  // ── 13. Multi-message format ──────────────────────────────────────────
  if (ctx.multiMessage?.enabled) {
    parts.push(`## Response Format
Your response MUST be a JSON array of strings. Each string is a separate WhatsApp message bubble.
- Maximum ${ctx.multiMessage.maxBubbles} messages
- Simple answers go in a single string: ["Sí, abrimos a las 3pm"]
- Split longer responses naturally: ["¡Hola! 👋", "Claro, te cuento cómo funciona"]
- NEVER repeat the same information across bubbles
- Prefer fewer bubbles. When in doubt, use 1 or 2.
- Plain text only, no markdown

Respond ONLY with the JSON array. Nothing else.`);
  }

  return parts.join('\n\n');
}
