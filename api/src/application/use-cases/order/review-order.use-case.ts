import { Logger } from '@nestjs/common';
import type { AiCompletionPort } from '../../ports/ai-completion.port.js';
import type { MessageRepository } from '../../../domain/repositories/message.repository.js';
import type { AiAgentConfigRepository } from '../../../domain/repositories/ai-agent-config.repository.js';
import type { OrderActionParams } from '../ai/handlers/order-directive.handler.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';

export interface ReviewOrderInput {
  orderData: OrderActionParams;
  conversationId: string;
  agentId: string;
}

export interface ReviewOrderResult {
  correctedOrder: OrderActionParams;
  corrections: string[];
  hadCorrections: boolean;
}

export class ReviewOrderUseCase {
  private readonly logger = new Logger(ReviewOrderUseCase.name);

  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly aiCompletion: AiCompletionPort,
    private readonly configRepo: AiAgentConfigRepository,
  ) {}

  async execute(input: ReviewOrderInput): Promise<ReviewOrderResult> {
    const noChange: ReviewOrderResult = {
      correctedOrder: input.orderData,
      corrections: [],
      hadCorrections: false,
    };

    // 1. Load AI config for provider/model/apiKey
    const config = await this.configRepo.findByAgentId(input.agentId);
    if (!config) {
      this.logger.warn(`No AI config for agent ${input.agentId}, skipping order review`);
      return noChange;
    }

    // 2. Load conversation messages
    const { data: messages } = await this.messageRepo.findByConversationId(
      input.conversationId, 1, 50,
    );

    if (messages.length === 0) {
      this.logger.warn(`No messages found for conversation ${input.conversationId}, skipping review`);
      return noChange;
    }

    const conversationText = messages
      .map((m) => {
        const role = m.direction === MessageDirection.INBOUND ? 'Cliente' : 'Negocio';
        return `[${role}]: ${m.body ?? '(media)'}`;
      })
      .join('\n');

    // 3. Build prompt and call LLM
    const systemPrompt = this.buildReviewPrompt(input.orderData, conversationText);

    const result = await this.aiCompletion.complete({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      systemPrompt,
      messages: [],
    });

    // 4. Parse and sanitize response
    return this.parseReviewResult(result.content, input.orderData);
  }

  private buildReviewPrompt(orderData: OrderActionParams, conversationText: string): string {
    return `You are an order verification assistant. Your job is to compare a customer's order (extracted by an AI system) against the actual conversation to catch any extraction errors.

## Conversation
${conversationText}

## Extracted Order
${JSON.stringify(orderData, null, 2)}

## Instructions
Compare the extracted order against what the customer ACTUALLY said in the conversation. Check for:

1. **Items**: Are all requested items present? Are item names correct? Are quantities correct? Are any items included that the customer did NOT request or explicitly removed?
2. **Item notes/extras**: Did the customer mention any special requests, extras, toppings, sizes, or modifications? Are they captured in the item notes?
3. **Delivery type**: Does the delivery type (delivery/pickup) match what the customer said?
4. **Address**: If delivery, does the address match what the customer provided?
5. **Payment method**: Does it match the customer's stated preference?
6. **Customer name**: Is it correct per the conversation?

## Rules
- Only fix CLEAR discrepancies supported by the conversation text.
- Do NOT add items the customer never mentioned.
- Do NOT change prices (unitPrice) — those come from the menu catalog and are correct.
- Do NOT change deliveryCost — it comes from business logic.
- Do NOT invent information not present in the conversation.
- If the order looks correct, return it unchanged with hadCorrections: false.
- Preserve all fields even if you don't change them.

## Response Format
Return ONLY a JSON object with exactly this structure (no markdown fences, no explanation):
{
  "correctedOrder": { ... same shape as the extracted order above ... },
  "corrections": ["description of correction 1", "description of correction 2"],
  "hadCorrections": true/false
}`;
  }

  private parseReviewResult(raw: string, fallback: OrderActionParams): ReviewOrderResult {
    const noChange: ReviewOrderResult = {
      correctedOrder: fallback,
      corrections: [],
      hadCorrections: false,
    };

    const tryParse = (str: string): ReviewOrderResult | null => {
      try {
        const parsed = JSON.parse(str);
        if (parsed.correctedOrder && Array.isArray(parsed.correctedOrder.items)) {
          return {
            correctedOrder: this.sanitizeOrderData(parsed.correctedOrder, fallback),
            corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
            hadCorrections: !!parsed.hadCorrections,
          };
        }
      } catch { /* fall through */ }
      return null;
    };

    // Direct parse
    let result = tryParse(raw);
    if (result) return result;

    // Try code fence extraction
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      result = tryParse(fenceMatch[1].trim());
      if (result) return result;
    }

    // Try bare JSON object extraction
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = tryParse(jsonMatch[0]);
      if (result) return result;
    }

    this.logger.warn(`Failed to parse order review result, using original order. Raw: ${raw.substring(0, 200)}`);
    return noChange;
  }

  private sanitizeOrderData(reviewed: any, original: OrderActionParams): OrderActionParams {
    const items = Array.isArray(reviewed.items)
      ? reviewed.items.map((item: any) => ({
          name: typeof item.name === 'string' ? item.name : '',
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
          unitPrice: original.items.find(
            (o) => o.name.toLowerCase().trim() === (item.name ?? '').toLowerCase().trim(),
          )?.unitPrice ?? item.unitPrice ?? 0,
          ...(typeof item.notes === 'string' && item.notes ? { notes: item.notes } : {}),
        }))
      : original.items;

    // Recalculate total from sanitized items
    const itemsTotal = items.reduce((sum: number, i: any) => sum + i.quantity * (i.unitPrice ?? 0), 0);
    const total = itemsTotal + (original.deliveryCost ?? 0);

    return {
      items,
      type: reviewed.type === 'delivery' || reviewed.type === 'pickup' ? reviewed.type : original.type,
      address: typeof reviewed.address === 'string' ? reviewed.address : original.address,
      notes: typeof reviewed.notes === 'string' ? reviewed.notes : original.notes,
      total: total || original.total,
      currency: original.currency,
      paymentMethod: typeof reviewed.paymentMethod === 'string' ? reviewed.paymentMethod : original.paymentMethod,
      customerName: typeof reviewed.customerName === 'string' ? reviewed.customerName : original.customerName,
      customerPhone: original.customerPhone,
      deliveryCost: original.deliveryCost,
      neighborhood: typeof reviewed.neighborhood === 'string' ? reviewed.neighborhood : original.neighborhood,
    };
  }
}
