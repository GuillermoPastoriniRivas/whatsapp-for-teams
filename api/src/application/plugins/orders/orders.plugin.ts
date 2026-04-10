import { Injectable, Logger } from '@nestjs/common';
import type {
  CognitivePlugin,
  PluginContext,
  PluginPromptContribution,
  PluginActionResult,
} from '../../../domain/value-objects/plugin.types.js';
import type {
  CognitiveAction,
  ActionExecutionResult,
  IntentResult,
} from '../../../domain/value-objects/cognitive-loop.types.js';
import { PhoneNumberPlugin } from '../../../domain/enums/phone-number-plugin.enum.js';
import { OrderFlowState } from '../../../domain/enums/order-flow-state.enum.js';
import type { PluginStateRepository } from '../../../domain/repositories/plugin-state.repository.js';
import type { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { OrderFlowDomainService } from '../../../domain/services/order-flow.domain-service.js';
import { OrderDirectiveHandler } from '../../use-cases/ai/handlers/order-directive.handler.js';
import type { OrderFlowData, CustomerInput, LastOrderDefaults } from '../../../domain/value-objects/order-flow.types.js';
import { createDefaultOrderFlow } from '../../../domain/value-objects/order-flow.types.js';
import {
  buildOrderIntentSections,
  buildOrderResponseSections,
  buildOrderFlowResponseDirective,
  type OrderPromptContext,
} from './orders-prompt.builder.js';
import type { ReviewOrderUseCase } from '../../use-cases/order/review-order.use-case.js';
import type { OrderActionParams } from '../../use-cases/ai/handlers/order-directive.handler.js';

@Injectable()
export class OrdersPlugin implements CognitivePlugin {
  readonly pluginId = PhoneNumberPlugin.ORDERS;
  readonly displayName = 'Orders';

  private readonly logger = new Logger(OrdersPlugin.name);
  private readonly flowService = new OrderFlowDomainService();

  constructor(
    private readonly stateRepo: PluginStateRepository,
    private readonly orderRepo: OrderRepository,
    private readonly orderHandler: OrderDirectiveHandler,
    private readonly reviewOrder: ReviewOrderUseCase,
  ) {}

  async buildPromptContributions(ctx: PluginContext): Promise<PluginPromptContribution> {
    const orderFlow = await this.stateRepo.getState<OrderFlowData>(ctx.conversationId, this.pluginId)
      ?? createDefaultOrderFlow();
    const orders = await this.orderRepo.findByConversationId(ctx.conversationId);

    const lastOrderDefaults = this.buildLastOrderDefaults(orders);
    const promptCtx: OrderPromptContext = { orders, orderFlow, lastOrderDefaults };

    return {
      intentPromptSections: buildOrderIntentSections(promptCtx),
      responsePromptSections: buildOrderResponseSections(promptCtx),
    };
  }

  getHandledActionTypes(): string[] {
    return ['extract_order_data', 'create_order'];
  }

  async executeAction(
    action: CognitiveAction,
    ctx: PluginContext,
    allActionResults: ActionExecutionResult[],
  ): Promise<PluginActionResult> {
    if (action.type === 'extract_order_data') {
      // Data extraction is handled in afterActions (state machine block)
      return { handled: true, result: 'Order data extracted' };
    }

    if (action.type === 'create_order') {
      const orderFlow = await this.stateRepo.getState<OrderFlowData>(ctx.conversationId, this.pluginId);
      if (orderFlow && orderFlow.state === OrderFlowState.COLLECTING) {
        this.logger.warn(`create_order BLOCKED: order flow state machine is active (state: ${orderFlow.state})`);
        return { handled: true, result: 'Order creation is managed by the order flow state machine. Use extract_order_data instead.' };
      }

      // Deduplication check
      const orders = await this.orderRepo.findByConversationId(ctx.conversationId);
      const newItems = (action.params.items as any[]) ?? [];
      const isDuplicate = orders.some((existing: any) => {
        if (existing.status !== 'pending' && existing.status !== 'confirmed') return false;
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs > 30 * 60 * 1000) return false;
        return this.isSameItemSet(existing.items, newItems);
      });

      if (isDuplicate) {
        this.logger.warn(`create_order SKIPPED: duplicate order detected`);
        return { handled: true, result: 'Order already exists with the same items (skipped duplicate)' };
      }

      const result = await this.orderHandler.handleAction(
        action.params as any,
        ctx.conversationId,
        ctx.contactId,
        ctx.phoneNumberId,
        ctx.tenantId,
      );
      return { handled: true, result };
    }

    return { handled: false };
  }

  async afterActions(
    ctx: PluginContext,
    intentResult: IntentResult,
    actionResults: ActionExecutionResult[],
  ): Promise<{ responseDirective: string | null }> {
    let orderFlow = await this.stateRepo.getState<OrderFlowData>(ctx.conversationId, this.pluginId)
      ?? createDefaultOrderFlow();

    // Migrate old 7-state values to the new 3-state lifecycle
    if (orderFlow.state && !['idle', 'collecting', 'order_created'].includes(orderFlow.state)) {
      orderFlow.state = OrderFlowState.COLLECTING;
    }

    // ── Menu image dedup: send once per order cycle, suppress repeats ──
    const menuImg = actionResults.find(
      (r) => r.action.type === 'send_menu_image' && r.success && r.result?.startsWith('menu_image_url:'),
    );
    if (menuImg) {
      if (orderFlow.menuImageSent) {
        menuImg.result = 'suppressed: menu image already sent';
        this.logger.log('send_menu_image suppressed (already sent this order cycle)');
      } else {
        orderFlow.menuImageSent = true;
        await this.stateRepo.setState(ctx.conversationId, this.pluginId, orderFlow);
      }
    }

    const extractAction = actionResults.find(
      (r) => r.action.type === 'extract_order_data' && r.success,
    );
    if (!extractAction) return { responseDirective: null };

    const orders = await this.orderRepo.findByConversationId(ctx.conversationId);
    const lastOrderDefaults = this.buildLastOrderDefaults(orders);

    const customerInput = extractAction.action.params as unknown as CustomerInput;
    const transition = this.flowService.transition(orderFlow, customerInput, lastOrderDefaults ?? undefined);

    // Save the flow state for directive building BEFORE any reset
    const directiveFlow = transition.newFlow;
    orderFlow = transition.newFlow;

    if (transition.shouldCreateOrder && transition.orderData) {
      this.logger.log(`Creating order from state machine: ${JSON.stringify(transition.orderData)}`);

      // LLM review pass: cross-check order against conversation (fail-open)
      let finalOrderData: Record<string, unknown> = transition.orderData as Record<string, unknown>;
      try {
        const reviewResult = await this.reviewOrder.execute({
          orderData: transition.orderData as unknown as OrderActionParams,
          conversationId: ctx.conversationId,
          agentId: ctx.agentId,
        });
        if (reviewResult.hadCorrections) {
          this.logger.log(`Order review corrections: ${reviewResult.corrections.join('; ')}`);
          finalOrderData = reviewResult.correctedOrder as unknown as Record<string, unknown>;
        }
      } catch (reviewError: any) {
        this.logger.warn(`Order review failed, proceeding with original: ${reviewError.message}`);
      }

      try {
        const orderResult = await this.orderHandler.handleAction(
          finalOrderData as any,
          ctx.conversationId,
          ctx.contactId,
          ctx.phoneNumberId,
          ctx.tenantId,
        );
        actionResults.push({
          action: { type: 'create_order', params: transition.orderData as any },
          success: true,
          result: orderResult,
        });

        orderFlow = createDefaultOrderFlow();
        this.logger.log(`Order created, flow reset to idle`);
      } catch (error: any) {
        this.logger.warn(`Order creation failed: ${error.message}`);
        actionResults.push({
          action: { type: 'create_order', params: transition.orderData as any },
          success: false,
          error: error.message,
        });
      }
    }

    await this.stateRepo.setState(ctx.conversationId, this.pluginId, orderFlow);

    const responseDirective = transition.directive
      ? buildOrderFlowResponseDirective(transition.directive, directiveFlow)
      : null;

    return { responseDirective };
  }

  async onConversationResolved(conversationId: string): Promise<void> {
    await this.stateRepo.clearState(conversationId, this.pluginId);
  }

  private buildLastOrderDefaults(orders: any[]): LastOrderDefaults | null {
    const lastCompletedOrder = orders.find(
      (o) => o.status === 'delivered' || o.status === 'confirmed' || o.status === 'pending',
    );
    if (!lastCompletedOrder) return null;
    return {
      deliveryType: lastCompletedOrder.deliveryType,
      deliveryAddress: lastCompletedOrder.deliveryAddress ?? undefined,
      neighborhood: lastCompletedOrder.neighborhood ?? undefined,
      paymentMethod: lastCompletedOrder.paymentMethod ?? undefined,
      customerName: lastCompletedOrder.customerName ?? undefined,
      deliveryCost: lastCompletedOrder.deliveryCost ?? undefined,
    };
  }

  private isSameItemSet(
    a: Array<{ name: string; quantity: number }>,
    b: Array<{ name: string; quantity: number }>,
  ): boolean {
    if (a.length !== b.length) return false;
    const normalize = (items: typeof a) =>
      items.map((i) => `${i.name.toLowerCase().trim()}:${i.quantity}`).sort().join('|');
    return normalize(a) === normalize(b);
  }
}
