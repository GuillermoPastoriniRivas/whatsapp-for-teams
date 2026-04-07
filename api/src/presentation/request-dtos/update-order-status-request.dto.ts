import { z } from 'zod';
import { OrderStatus } from '../../domain/enums/order-status.enum.js';

export const UpdateOrderStatusRequestSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export type UpdateOrderStatusRequestDto = z.infer<typeof UpdateOrderStatusRequestSchema>;
