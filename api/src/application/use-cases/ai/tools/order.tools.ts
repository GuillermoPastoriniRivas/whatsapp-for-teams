import { Logger } from '@nestjs/common';
import { access } from 'fs/promises';
import { join } from 'path';
import type { RegisteredTool, ToolContext } from './tool-registry.js';
import type { OrderDirectiveHandler } from '../handlers/order-directive.handler.js';
import type { OrderRepository } from '../../../../domain/repositories/order.repository.js';

const logger = new Logger('OrderTools');

export function createOrderTools(
  orderHandler: OrderDirectiveHandler,
  orderRepo: OrderRepository,
  apiBaseUrl: string,
): RegisteredTool[] {
  return [
    // ── create_order ─────────────────────────────────────────────────────
    {
      definition: {
        name: 'create_order',
        description: 'Create a new order for the customer. Call this only when you have collected all required information (items, delivery type, and for delivery: address, neighborhood, payment method) and the customer has confirmed.',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'List of items to order. Use prices from the knowledge base.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                  unitPrice: { type: 'number', description: 'Price per unit from the menu' },
                  notes: { type: 'string', description: 'Special requests, size, flavor, etc.' },
                },
                required: ['name', 'quantity', 'unitPrice'],
              },
            },
            deliveryType: { type: 'string', enum: ['delivery', 'pickup'] },
            deliveryAddress: { type: 'string' },
            neighborhood: { type: 'string', description: 'Barrio for delivery cost lookup' },
            paymentMethod: { type: 'string' },
            deliveryCost: { type: 'number', description: 'Delivery cost based on neighborhood from knowledge base' },
            deliveryNotes: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            currency: { type: 'string', description: 'Currency code (e.g. COP, UYU)' },
          },
          required: ['items', 'deliveryType'],
        },
      },
      handler: async (args, ctx) => {
        const items = args.items as Array<{ name: string; quantity: number; unitPrice: number; notes?: string }>;
        if (!items?.length) return 'Error: No items provided. Ask the customer what they want to order.';

        const missingPrices = items.filter((i) => typeof i.unitPrice !== 'number');
        if (missingPrices.length > 0) {
          return `Error: Items missing unitPrice: ${missingPrices.map((i) => i.name).join(', ')}. Look up prices from the knowledge base.`;
        }

        // Dedup check
        const existing = await orderRepo.findByConversationId(ctx.conversationId);
        const isDuplicate = existing.some((o) => {
          if (o.status !== 'pending' && o.status !== 'confirmed') return false;
          if (Date.now() - new Date(o.createdAt).getTime() > 30 * 60 * 1000) return false;
          if (o.items.length !== items.length) return false;
          const normalize = (list: typeof items) =>
            list.map((i) => `${i.name.toLowerCase().trim()}:${i.quantity}`).sort().join('|');
          return normalize(o.items as typeof items) === normalize(items);
        });
        if (isDuplicate) return 'This order already exists (duplicate detected). The customer already has this order pending.';

        // Calculate total server-side
        const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        const deliveryCost = typeof args.deliveryCost === 'number' ? args.deliveryCost : 0;
        const total = itemsTotal + deliveryCost;

        try {
          const result = await orderHandler.handleAction(
            {
              items,
              type: (args.deliveryType as string) ?? 'pickup',
              address: args.deliveryAddress as string | undefined,
              notes: args.deliveryNotes as string | undefined,
              total,
              currency: args.currency as string | undefined,
              paymentMethod: args.paymentMethod as string | undefined,
              customerName: args.customerName as string | undefined,
              customerPhone: args.customerPhone as string | undefined,
              deliveryCost: typeof args.deliveryCost === 'number' ? args.deliveryCost : undefined,
              neighborhood: args.neighborhood as string | undefined,
            },
            ctx.conversationId,
            ctx.contactId,
            ctx.phoneNumberId,
            ctx.tenantId,
          );
          return `Order created successfully. Order ID: ${result.orderId}. Total: ${total}`;
        } catch (error: any) {
          logger.error(`create_order failed: ${error.message}`);
          return `Error creating order: ${error.message}`;
        }
      },
    },

    // ── update_order ─────────────────────────────────────────────────────
    {
      definition: {
        name: 'update_order',
        description: 'Update an existing pending order. Use when the customer wants to add/remove/change items, change delivery details, or change payment method.',
        parameters: {
          type: 'object',
          properties: {
            orderId: { type: 'string', description: 'The order ID to update' },
            items: {
              type: 'array',
              description: 'The COMPLETE updated list of items (replaces all current items)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                  unitPrice: { type: 'number' },
                  notes: { type: 'string' },
                },
                required: ['name', 'quantity', 'unitPrice'],
              },
            },
            deliveryAddress: { type: 'string' },
            neighborhood: { type: 'string' },
            paymentMethod: { type: 'string' },
            deliveryCost: { type: 'number' },
            deliveryNotes: { type: 'string' },
          },
          required: ['orderId'],
        },
      },
      handler: async (args, ctx) => {
        const orderId = args.orderId as string;
        if (!orderId) return 'Error: orderId is required';

        const order = await orderRepo.findById(orderId);
        if (!order) return `Error: Order ${orderId} not found`;
        if (order.status === 'delivered' || order.status === 'cancelled') {
          return `Error: Cannot update order — it is already ${order.status}`;
        }

        const updates: Record<string, unknown> = {};
        if (args.items) {
          const items = args.items as Array<{ name: string; quantity: number; unitPrice: number; notes?: string }>;
          updates.items = items;
          const itemsTotal = items.reduce((sum, i) => sum + i.quantity * (i.unitPrice ?? 0), 0);
          const dc = typeof args.deliveryCost === 'number' ? args.deliveryCost : (order.deliveryCost ?? 0);
          updates.estimatedTotal = itemsTotal + dc;
        }
        if (args.deliveryAddress !== undefined) updates.deliveryAddress = args.deliveryAddress;
        if (args.neighborhood !== undefined) updates.neighborhood = args.neighborhood;
        if (args.paymentMethod !== undefined) updates.paymentMethod = args.paymentMethod;
        if (args.deliveryCost !== undefined) updates.deliveryCost = args.deliveryCost;
        if (args.deliveryNotes !== undefined) updates.deliveryNotes = args.deliveryNotes;

        try {
          await orderRepo.update(orderId, updates as any);
          return `Order ${orderId.slice(-6)} updated successfully`;
        } catch (error: any) {
          logger.error(`update_order failed: ${error.message}`);
          return `Error updating order: ${error.message}`;
        }
      },
    },

    // ── get_orders ───────────────────────────────────────────────────────
    {
      definition: {
        name: 'get_orders',
        description: "Get the customer's orders in this conversation. Use to check order status, review items, or check if there's an active order before creating a new one.",
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args, ctx) => {
        const orders = await orderRepo.findByConversationId(ctx.conversationId);
        if (orders.length === 0) return 'No orders found for this customer.';

        const statusMap: Record<string, string> = {
          pending: 'Pendiente',
          confirmed: 'Confirmado',
          preparing: 'En preparación',
          ready: 'Listo para recoger',
          on_the_way: 'En camino',
          delivered: 'Entregado',
          cancelled: 'Cancelado',
        };

        const lines = orders.map((o) => {
          const items = o.items.map((i) => `${i.quantity}x ${i.name} ($${i.unitPrice ?? '?'})`).join(', ');
          return [
            `Order #${o.id.slice(-6)} — ${statusMap[o.status] ?? o.status}`,
            `  Items: ${items}`,
            `  Type: ${o.deliveryType}${o.deliveryAddress ? ` → ${o.deliveryAddress}` : ''}${o.neighborhood ? ` (${o.neighborhood})` : ''}`,
            `  Total: ${o.estimatedTotal ?? 'N/A'} ${o.currency ?? ''}`,
            o.paymentMethod ? `  Payment: ${o.paymentMethod}` : null,
            `  Created: ${o.createdAt.toISOString()}`,
          ].filter(Boolean).join('\n');
        });

        return lines.join('\n\n');
      },
    },

    // ── send_menu_image ──────────────────────────────────────────────────
    {
      definition: {
        name: 'send_menu_image',
        description: 'Send the business menu image to the customer. Only use when they explicitly ask to SEE or VIEW the full menu (e.g. "quiero ver el menú", "pásame la carta"). Do NOT use when answering specific questions about products — use the knowledge base for that.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args, ctx) => {
        for (const ext of ['jpeg', 'jpg', 'png']) {
          const filePath = join(process.cwd(), 'public', 'menus', `${ctx.tenantId}.${ext}`);
          try {
            await access(filePath);
            // Signal prefix tells ProcessAiResponseUseCase to send the image after the text response.
            return `menu_image_url:${apiBaseUrl}/public/menus/${ctx.tenantId}.${ext}`;
          } catch {
            // try next extension
          }
        }
        return 'No menu image available for this business. Describe the menu options from the knowledge base instead.';
      },
    },
  ];
}
