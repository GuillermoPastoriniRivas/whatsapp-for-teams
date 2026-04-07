import { z } from 'zod';

const OrderItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const CreateOrderRequestSchema = z.object({
  conversationId: z.string().min(1),
  items: z.array(OrderItemSchema).min(1),
  deliveryType: z.enum(['delivery', 'pickup']),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  estimatedTotal: z.number().nonnegative().optional(),
  currency: z.string().optional(),
});

export type CreateOrderRequestDto = z.infer<typeof CreateOrderRequestSchema>;
