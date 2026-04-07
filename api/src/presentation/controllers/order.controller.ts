import { Controller, Get, Post, Patch, Body, Param, Query, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { CreateOrderUseCase } from '../../application/use-cases/order/create-order.use-case.js';
import { ListOrdersUseCase } from '../../application/use-cases/order/list-orders.use-case.js';
import { GetOrderUseCase } from '../../application/use-cases/order/get-order.use-case.js';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/order/update-order-status.use-case.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { OrderQueryParamsSchema } from '../request-dtos/order-query-params.dto.js';
import type { OrderQueryParamsDto } from '../request-dtos/order-query-params.dto.js';
import { CreateOrderRequestSchema } from '../request-dtos/create-order-request.dto.js';
import type { CreateOrderRequestDto } from '../request-dtos/create-order-request.dto.js';
import { UpdateOrderStatusRequestSchema } from '../request-dtos/update-order-status-request.dto.js';
import type { UpdateOrderStatusRequestDto } from '../request-dtos/update-order-status-request.dto.js';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository.js';

@ApiTags('Orders')
@ApiBearerAuth('JWT')
@Controller('orders')
export class OrderController {
  constructor(
    @Inject('CreateOrderUseCase') private readonly createOrder: CreateOrderUseCase,
    @Inject('ListOrdersUseCase') private readonly listOrders: ListOrdersUseCase,
    @Inject('GetOrderUseCase') private readonly getOrder: GetOrderUseCase,
    @Inject('UpdateOrderStatusUseCase') private readonly updateOrderStatus: UpdateOrderStatusUseCase,
    @Inject('ConversationRepository') private readonly conversationRepo: ConversationRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders', description: 'List orders with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of orders' })
  async list(
    @Query(new ZodValidationPipe(OrderQueryParamsSchema)) query: OrderQueryParamsDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    return this.listOrders.execute({
      tenantId: agent.tenantId,
      status: query.status,
      phoneNumberId: query.phoneNumberId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order', description: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async get(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getOrder.execute(id, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Create order', description: 'Create an order manually (human agent)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async create(
    @Body(new ZodValidationPipe(CreateOrderRequestSchema)) body: CreateOrderRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    // Verify conversation belongs to the tenant
    const conversation = await this.conversationRepo.findById(body.conversationId);
    if (!conversation || conversation.tenantId !== agent.tenantId) {
      throw new ForbiddenException('Conversation not found or not accessible');
    }

    const result = await this.createOrder.execute({
      tenantId: agent.tenantId,
      conversationId: body.conversationId,
      contactId: conversation.contactId,
      phoneNumberId: conversation.phoneNumberId,
      createdByAgentId: agent._id,
      items: body.items,
      deliveryType: body.deliveryType,
      deliveryAddress: body.deliveryAddress ?? null,
      deliveryNotes: body.deliveryNotes ?? null,
      estimatedTotal: body.estimatedTotal ?? null,
      currency: body.currency ?? null,
    });

    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status', description: 'Change the status of an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusRequestSchema)) body: UpdateOrderStatusRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateOrderStatus.execute(id, body.status, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
