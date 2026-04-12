import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { DemoGuard } from './guards/demo.guard.js';

// Controllers
import { AuthController } from './controllers/auth.controller.js';
import { AgentController } from './controllers/agent.controller.js';
import { PhoneNumberController } from './controllers/phone-number.controller.js';
import { ConversationController } from './controllers/conversation.controller.js';
import { TenantController } from './controllers/tenant.controller.js';
import { WebhookController } from './controllers/webhook.controller.js';
import { ContactController } from './controllers/contact.controller.js';

// Use Cases — Auth
import { LoginUseCase } from '../application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from '../application/use-cases/auth/refresh-token.use-case.js';
import { GetCurrentAgentUseCase } from '../application/use-cases/auth/get-current-agent.use-case.js';
import { DemoLoginUseCase } from '../application/use-cases/auth/demo-login.use-case.js';
import { GoogleLoginUseCase } from '../application/use-cases/auth/google-login.use-case.js';
import { ForgotPasswordUseCase } from '../application/use-cases/auth/forgot-password.use-case.js';
import { ResetPasswordUseCase } from '../application/use-cases/auth/reset-password.use-case.js';
import { SignupUseCase } from '../application/use-cases/auth/signup.use-case.js';
import { VerifyEmailUseCase } from '../application/use-cases/auth/verify-email.use-case.js';
import { CompleteOnboardingUseCase } from '../application/use-cases/auth/complete-onboarding.use-case.js';

// Use Cases — Agent
import { CreateAgentUseCase } from '../application/use-cases/agent/create-agent.use-case.js';
import { InviteAgentUseCase } from '../application/use-cases/agent/invite-agent.use-case.js';
import { ListAgentsUseCase } from '../application/use-cases/agent/list-agents.use-case.js';
import { UpdateAgentStatusUseCase } from '../application/use-cases/agent/update-agent-status.use-case.js';
import { UpdateAgentProfileUseCase } from '../application/use-cases/agent/update-agent-profile.use-case.js';
import { DeleteAgentUseCase } from '../application/use-cases/agent/delete-agent.use-case.js';
import { GrantPhoneAccessUseCase } from '../application/use-cases/agent/grant-phone-access.use-case.js';
import { RevokePhoneAccessUseCase } from '../application/use-cases/agent/revoke-phone-access.use-case.js';
import { GetAgentPhoneAccessUseCase } from '../application/use-cases/agent/get-agent-phone-access.use-case.js';

// Use Cases — Phone Number
import { RegisterPhoneNumberUseCase } from '../application/use-cases/phone-number/register-phone-number.use-case.js';
import { ListPhoneNumbersUseCase } from '../application/use-cases/phone-number/list-phone-numbers.use-case.js';
import { UpdatePhoneNumberUseCase } from '../application/use-cases/phone-number/update-phone-number.use-case.js';
import { GetActivePluginsUseCase } from '../application/use-cases/phone-number/get-active-plugins.use-case.js';

// Use Cases — Conversation
import { ListConversationsUseCase } from '../application/use-cases/conversation/list-conversations.use-case.js';
import { GetConversationDetailUseCase } from '../application/use-cases/conversation/get-conversation-detail.use-case.js';
import { GetConversationMessagesUseCase } from '../application/use-cases/conversation/get-conversation-messages.use-case.js';
import { SendMessageUseCase } from '../application/use-cases/conversation/send-message.use-case.js';
import { AssignConversationUseCase } from '../application/use-cases/conversation/assign-conversation.use-case.js';
import { AutoAssignConversationUseCase } from '../application/use-cases/conversation/auto-assign-conversation.use-case.js';
import { ResolveConversationUseCase } from '../application/use-cases/conversation/resolve-conversation.use-case.js';
import { GetConversationEventsUseCase } from '../application/use-cases/conversation/get-conversation-events.use-case.js';
import { AddConversationNoteUseCase } from '../application/use-cases/conversation/add-conversation-note.use-case.js';
import { GetConversationNotesUseCase } from '../application/use-cases/conversation/get-conversation-notes.use-case.js';
import { DemoAiReplyUseCase } from '../application/use-cases/conversation/demo-ai-reply.use-case.js';

// Use Cases — Contact
import { UpdateContactUseCase } from '../application/use-cases/contact/update-contact.use-case.js';
import { ListContactsUseCase } from '../application/use-cases/contact/list-contacts.use-case.js';

// Use Cases — Tenant
import { CreateTenantUseCase } from '../application/use-cases/tenant/create-tenant.use-case.js';
import { GetTenantUseCase } from '../application/use-cases/tenant/get-tenant.use-case.js';

// Use Cases — Webhook
import { HandleInboundMessageUseCase } from '../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../application/use-cases/webhook/handle-status-update.use-case.js';

// Use Cases — AI Agent
import { CreateAiAgentUseCase } from '../application/use-cases/ai/create-ai-agent.use-case.js';
import { GetAiAgentUseCase } from '../application/use-cases/ai/get-ai-agent.use-case.js';
import { ListAiAgentsUseCase } from '../application/use-cases/ai/list-ai-agents.use-case.js';
import { UpdateAiAgentConfigUseCase } from '../application/use-cases/ai/update-ai-agent-config.use-case.js';
import { DeleteAiAgentUseCase } from '../application/use-cases/ai/delete-ai-agent.use-case.js';
import { ProcessAiResponseUseCase } from '../application/use-cases/ai/process-ai-response.use-case.js';
import { HandoffToHumanUseCase } from '../application/use-cases/ai/handoff-to-human.use-case.js';
import { OrderDirectiveHandler } from '../application/use-cases/ai/handlers/order-directive.handler.js';

// Use Cases — Order
import { CreateOrderUseCase } from '../application/use-cases/order/create-order.use-case.js';
import { ListOrdersUseCase } from '../application/use-cases/order/list-orders.use-case.js';
import { GetOrderUseCase } from '../application/use-cases/order/get-order.use-case.js';
import { UpdateOrderStatusUseCase } from '../application/use-cases/order/update-order-status.use-case.js';
import { NotifyOrderStatusUseCase } from '../application/use-cases/order/notify-order-status.use-case.js';

// Use Cases — Label
import { CreateLabelUseCase } from '../application/use-cases/label/create-label.use-case.js';
import { ListLabelsUseCase } from '../application/use-cases/label/list-labels.use-case.js';
import { UpdateLabelUseCase } from '../application/use-cases/label/update-label.use-case.js';
import { DeleteLabelUseCase } from '../application/use-cases/label/delete-label.use-case.js';
import { AssignLabelUseCase } from '../application/use-cases/label/assign-label.use-case.js';
import { RemoveLabelUseCase } from '../application/use-cases/label/remove-label.use-case.js';
import { GetConversationLabelsUseCase } from '../application/use-cases/label/get-conversation-labels.use-case.js';

// Controllers — AI
import { AiAgentController } from './controllers/ai-agent.controller.js';

// Controllers — Order
import { OrderController } from './controllers/order.controller.js';

// Controllers — Label
import { LabelController } from './controllers/label.controller.js';

// Controllers — Billing
import { BillingController } from './controllers/billing.controller.js';
import { PaymentWebhookController } from './controllers/payment-webhook.controller.js';

// Use Cases — Billing
import { SubscribeUseCase } from '../application/use-cases/billing/subscribe.use-case.js';
import { ChangePlanUseCase } from '../application/use-cases/billing/change-plan.use-case.js';
import { CancelSubscriptionUseCase } from '../application/use-cases/billing/cancel-subscription.use-case.js';
import { GetSubscriptionUseCase } from '../application/use-cases/billing/get-subscription.use-case.js';
import { GetBillingHistoryUseCase } from '../application/use-cases/billing/get-billing-history.use-case.js';
import { CheckPlanLimitUseCase } from '../application/use-cases/billing/check-plan-limit.use-case.js';
import { EnforcePlanLimitsUseCase } from '../application/use-cases/billing/enforce-plan-limits.use-case.js';
import { ToggleResourceUseCase } from '../application/use-cases/billing/toggle-resource.use-case.js';
import { CreateCheckoutUseCase } from '../application/use-cases/billing/create-checkout.use-case.js';
import { HandlePaymentWebhookUseCase } from '../application/use-cases/billing/handle-payment-webhook.use-case.js';

// Guards — Plan Limit
import { PlanLimitGuard } from './guards/plan-limit.guard.js';

// Queue Processors
import { WebhookJobProcessor } from '../infrastructure/queue/webhook-job.processor.js';
import { AiResponseJobProcessor } from '../infrastructure/queue/ai-response-job.processor.js';
import { EmailJobProcessor } from '../infrastructure/queue/email-job.processor.js';

const useCaseProviders = [
  // Auth
  {
    provide: 'LoginUseCase',
    useFactory: (agentRepo: any, refreshTokenRepo: any, hasher: any, tokenProvider: any) =>
      new LoginUseCase(agentRepo, refreshTokenRepo, hasher, tokenProvider),
    inject: ['AgentRepository', 'RefreshTokenRepository', 'PasswordHasherPort', 'TokenProviderPort'],
  },
  {
    provide: 'RefreshTokenUseCase',
    useFactory: (refreshTokenRepo: any, agentRepo: any, tokenProvider: any) =>
      new RefreshTokenUseCase(refreshTokenRepo, agentRepo, tokenProvider),
    inject: ['RefreshTokenRepository', 'AgentRepository', 'TokenProviderPort'],
  },
  {
    provide: 'GetCurrentAgentUseCase',
    useFactory: (agentRepo: any) => new GetCurrentAgentUseCase(agentRepo),
    inject: ['AgentRepository'],
  },
  {
    provide: 'DemoLoginUseCase',
    useFactory: (agentRepo: any, refreshTokenRepo: any, tokenProvider: any) =>
      new DemoLoginUseCase(agentRepo, refreshTokenRepo, tokenProvider),
    inject: ['AgentRepository', 'RefreshTokenRepository', 'TokenProviderPort'],
  },
  {
    provide: 'GoogleLoginUseCase',
    useFactory: (agentRepo: any, refreshTokenRepo: any, tokenProvider: any, tenantRepo: any) =>
      new GoogleLoginUseCase(agentRepo, refreshTokenRepo, tokenProvider, tenantRepo, process.env.GOOGLE_CLIENT_ID ?? ''),
    inject: ['AgentRepository', 'RefreshTokenRepository', 'TokenProviderPort', 'TenantRepository'],
  },
  {
    provide: 'ForgotPasswordUseCase',
    useFactory: (agentRepo: any, resetTokenRepo: any, jobQueue: any) =>
      new ForgotPasswordUseCase(agentRepo, resetTokenRepo, jobQueue, process.env.FRONTEND_URL ?? 'http://localhost:3001', process.env.SES_FROM_EMAIL ?? 'no-reply@asis.chat'),
    inject: ['AgentRepository', 'PasswordResetTokenRepository', 'JobQueuePort'],
  },
  {
    provide: 'ResetPasswordUseCase',
    useFactory: (resetTokenRepo: any, agentRepo: any, refreshTokenRepo: any, hasher: any) =>
      new ResetPasswordUseCase(resetTokenRepo, agentRepo, refreshTokenRepo, hasher),
    inject: ['PasswordResetTokenRepository', 'AgentRepository', 'RefreshTokenRepository', 'PasswordHasherPort'],
  },
  {
    provide: 'SignupUseCase',
    useFactory: (agentRepo: any, tenantRepo: any, refreshTokenRepo: any, resetTokenRepo: any, hasher: any, tokenProvider: any, jobQueue: any) =>
      new SignupUseCase(agentRepo, tenantRepo, refreshTokenRepo, resetTokenRepo, hasher, tokenProvider, jobQueue, process.env.FRONTEND_URL ?? 'http://localhost:3001', process.env.SES_FROM_EMAIL ?? 'no-reply@asis.chat'),
    inject: ['AgentRepository', 'TenantRepository', 'RefreshTokenRepository', 'PasswordResetTokenRepository', 'PasswordHasherPort', 'TokenProviderPort', 'JobQueuePort'],
  },
  {
    provide: 'VerifyEmailUseCase',
    useFactory: (resetTokenRepo: any, agentRepo: any) => new VerifyEmailUseCase(resetTokenRepo, agentRepo),
    inject: ['PasswordResetTokenRepository', 'AgentRepository'],
  },
  {
    provide: 'CompleteOnboardingUseCase',
    useFactory: (agentRepo: any) => new CompleteOnboardingUseCase(agentRepo),
    inject: ['AgentRepository'],
  },

  // Agent
  {
    provide: 'CreateAgentUseCase',
    useFactory: (agentRepo: any, hasher: any) => new CreateAgentUseCase(agentRepo, hasher),
    inject: ['AgentRepository', 'PasswordHasherPort'],
  },
  {
    provide: 'InviteAgentUseCase',
    useFactory: (agentRepo: any, tenantRepo: any, resetTokenRepo: any, jobQueue: any) =>
      new InviteAgentUseCase(agentRepo, tenantRepo, resetTokenRepo, jobQueue, process.env.FRONTEND_URL ?? 'http://localhost:3001', process.env.SES_FROM_EMAIL ?? 'no-reply@asis.chat'),
    inject: ['AgentRepository', 'TenantRepository', 'PasswordResetTokenRepository', 'JobQueuePort'],
  },
  {
    provide: 'ListAgentsUseCase',
    useFactory: (agentRepo: any) => new ListAgentsUseCase(agentRepo),
    inject: ['AgentRepository'],
  },
  {
    provide: 'AutoAssignConversationUseCase',
    useFactory: (convRepo: any, agentRepo: any, accessRepo: any, gateway: any, eventRepo: any) =>
      new AutoAssignConversationUseCase(convRepo, agentRepo, accessRepo, gateway, eventRepo),
    inject: ['ConversationRepository', 'AgentRepository', 'AgentPhoneAccessRepository', 'RealtimeGatewayPort', 'ConversationEventRepository'],
  },
  {
    provide: 'UpdateAgentStatusUseCase',
    useFactory: (agentRepo: any, convRepo: any, autoAssign: any) =>
      new UpdateAgentStatusUseCase(agentRepo, convRepo, autoAssign),
    inject: ['AgentRepository', 'ConversationRepository', 'AutoAssignConversationUseCase'],
  },
  {
    provide: 'UpdateAgentProfileUseCase',
    useFactory: (agentRepo: any) => new UpdateAgentProfileUseCase(agentRepo),
    inject: ['AgentRepository'],
  },
  {
    provide: 'DeleteAgentUseCase',
    useFactory: (agentRepo: any) => new DeleteAgentUseCase(agentRepo),
    inject: ['AgentRepository'],
  },
  {
    provide: 'GrantPhoneAccessUseCase',
    useFactory: (accessRepo: any, phoneRepo: any, agentRepo: any) =>
      new GrantPhoneAccessUseCase(accessRepo, phoneRepo, agentRepo),
    inject: ['AgentPhoneAccessRepository', 'PhoneNumberRepository', 'AgentRepository'],
  },
  {
    provide: 'RevokePhoneAccessUseCase',
    useFactory: (accessRepo: any, convRepo: any, autoAssign: any) =>
      new RevokePhoneAccessUseCase(accessRepo, convRepo, autoAssign),
    inject: ['AgentPhoneAccessRepository', 'ConversationRepository', 'AutoAssignConversationUseCase'],
  },
  {
    provide: 'GetAgentPhoneAccessUseCase',
    useFactory: (accessRepo: any, phoneRepo: any) => new GetAgentPhoneAccessUseCase(accessRepo, phoneRepo),
    inject: ['AgentPhoneAccessRepository', 'PhoneNumberRepository'],
  },

  // Phone Number
  {
    provide: 'RegisterPhoneNumberUseCase',
    useFactory: (phoneRepo: any) => new RegisterPhoneNumberUseCase(phoneRepo),
    inject: ['PhoneNumberRepository'],
  },
  {
    provide: 'ListPhoneNumbersUseCase',
    useFactory: (phoneRepo: any) => new ListPhoneNumbersUseCase(phoneRepo),
    inject: ['PhoneNumberRepository'],
  },
  {
    provide: 'UpdatePhoneNumberUseCase',
    useFactory: (phoneRepo: any) => new UpdatePhoneNumberUseCase(phoneRepo),
    inject: ['PhoneNumberRepository'],
  },
  {
    provide: 'GetActivePluginsUseCase',
    useFactory: (phoneRepo: any) => new GetActivePluginsUseCase(phoneRepo),
    inject: ['PhoneNumberRepository'],
  },

  // Conversation
  {
    provide: 'ListConversationsUseCase',
    useFactory: (convRepo: any) => new ListConversationsUseCase(convRepo),
    inject: ['ConversationRepository'],
  },
  {
    provide: 'GetConversationDetailUseCase',
    useFactory: (convRepo: any) => new GetConversationDetailUseCase(convRepo),
    inject: ['ConversationRepository'],
  },
  {
    provide: 'GetConversationMessagesUseCase',
    useFactory: (msgRepo: any, convRepo: any) => new GetConversationMessagesUseCase(msgRepo, convRepo),
    inject: ['MessageRepository', 'ConversationRepository'],
  },
  {
    provide: 'SendMessageUseCase',
    useFactory: (convRepo: any, msgRepo: any, contactRepo: any, phoneRepo: any, messagingApi: any, gateway: any, agentRepo: any) =>
      new SendMessageUseCase(convRepo, msgRepo, contactRepo, phoneRepo, messagingApi, gateway, agentRepo),
    inject: ['ConversationRepository', 'MessageRepository', 'ContactRepository', 'PhoneNumberRepository', 'MessagingApiPort', 'RealtimeGatewayPort', 'AgentRepository'],
  },
  {
    provide: 'AssignConversationUseCase',
    useFactory: (convRepo: any, agentRepo: any, gateway: any, eventRepo: any) =>
      new AssignConversationUseCase(convRepo, agentRepo, gateway, eventRepo),
    inject: ['ConversationRepository', 'AgentRepository', 'RealtimeGatewayPort', 'ConversationEventRepository'],
  },
  {
    provide: 'GetConversationEventsUseCase',
    useFactory: (eventRepo: any) => new GetConversationEventsUseCase(eventRepo),
    inject: ['ConversationEventRepository'],
  },
  {
    provide: 'AddConversationNoteUseCase',
    useFactory: (noteRepo: any, convRepo: any, agentRepo: any, eventRepo: any, gateway: any) =>
      new AddConversationNoteUseCase(noteRepo, convRepo, agentRepo, eventRepo, gateway),
    inject: ['ConversationNoteRepository', 'ConversationRepository', 'AgentRepository', 'ConversationEventRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'GetConversationNotesUseCase',
    useFactory: (noteRepo: any) => new GetConversationNotesUseCase(noteRepo),
    inject: ['ConversationNoteRepository'],
  },
  {
    provide: 'DemoAiReplyUseCase',
    useFactory: (convRepo: any, msgRepo: any, agentRepo: any, tenantRepo: any, gateway: any) =>
      new DemoAiReplyUseCase(convRepo, msgRepo, agentRepo, tenantRepo, gateway),
    inject: ['ConversationRepository', 'MessageRepository', 'AgentRepository', 'TenantRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'ResolveConversationUseCase',
    useFactory: (convRepo: any, agentRepo: any, gateway: any, eventRepo: any, pluginStateRepo: any) =>
      new ResolveConversationUseCase(convRepo, agentRepo, gateway, eventRepo, pluginStateRepo),
    inject: ['ConversationRepository', 'AgentRepository', 'RealtimeGatewayPort', 'ConversationEventRepository', 'PluginStateRepository'],
  },

  // Tenant
  {
    provide: 'CreateTenantUseCase',
    useFactory: (tenantRepo: any) => new CreateTenantUseCase(tenantRepo),
    inject: ['TenantRepository'],
  },
  {
    provide: 'GetTenantUseCase',
    useFactory: (tenantRepo: any) => new GetTenantUseCase(tenantRepo),
    inject: ['TenantRepository'],
  },

  // Contact
  {
    provide: 'UpdateContactUseCase',
    useFactory: (contactRepo: any) => new UpdateContactUseCase(contactRepo),
    inject: ['ContactRepository'],
  },
  {
    provide: 'ListContactsUseCase',
    useFactory: (contactRepo: any) => new ListContactsUseCase(contactRepo),
    inject: ['ContactRepository'],
  },

  // Webhook
  {
    provide: 'HandleInboundMessageUseCase',
    useFactory: (phoneRepo: any, contactRepo: any, convRepo: any, msgRepo: any, gateway: any, autoAssign: any, eventRepo: any, agentRepo: any, jobQueue: any, aiConfigRepo: any, messagingApi: any) =>
      new HandleInboundMessageUseCase(phoneRepo, contactRepo, convRepo, msgRepo, gateway, autoAssign, eventRepo, agentRepo, jobQueue, aiConfigRepo, messagingApi),
    inject: ['PhoneNumberRepository', 'ContactRepository', 'ConversationRepository', 'MessageRepository', 'RealtimeGatewayPort', 'AutoAssignConversationUseCase', 'ConversationEventRepository', 'AgentRepository', 'JobQueuePort', 'AiAgentConfigRepository', 'MessagingApiPort'],
  },
  {
    provide: 'HandleStatusUpdateUseCase',
    useFactory: (msgRepo: any, gateway: any) => new HandleStatusUpdateUseCase(msgRepo, gateway),
    inject: ['MessageRepository', 'RealtimeGatewayPort'],
  },

  // AI Agent
  {
    provide: 'CreateAiAgentUseCase',
    useFactory: (agentRepo: any, configRepo: any) => new CreateAiAgentUseCase(agentRepo, configRepo),
    inject: ['AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'GetAiAgentUseCase',
    useFactory: (agentRepo: any, configRepo: any) => new GetAiAgentUseCase(agentRepo, configRepo),
    inject: ['AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'ListAiAgentsUseCase',
    useFactory: (agentRepo: any, configRepo: any) => new ListAiAgentsUseCase(agentRepo, configRepo),
    inject: ['AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'UpdateAiAgentConfigUseCase',
    useFactory: (agentRepo: any, configRepo: any) => new UpdateAiAgentConfigUseCase(agentRepo, configRepo),
    inject: ['AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'DeleteAiAgentUseCase',
    useFactory: (agentRepo: any, configRepo: any) => new DeleteAiAgentUseCase(agentRepo, configRepo),
    inject: ['AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'HandoffToHumanUseCase',
    useFactory: (convRepo: any, agentRepo: any, noteRepo: any, eventRepo: any, gateway: any, autoAssign: any) =>
      new HandoffToHumanUseCase(convRepo, agentRepo, noteRepo, eventRepo, gateway, autoAssign),
    inject: ['ConversationRepository', 'AgentRepository', 'ConversationNoteRepository', 'ConversationEventRepository', 'RealtimeGatewayPort', 'AutoAssignConversationUseCase'],
  },
  {
    provide: 'ProcessAiResponseUseCase',
    useFactory: (convRepo: any, msgRepo: any, contactRepo: any, phoneRepo: any, agentRepo: any, configRepo: any, usageRepo: any, aiCompletion: any, messagingApi: any, gateway: any, handoff: any, labelRepo: any, convLabelRepo: any, eventRepo: any, orderRepo: any, orderHandler: any) =>
      new ProcessAiResponseUseCase(convRepo, msgRepo, contactRepo, phoneRepo, agentRepo, configRepo, usageRepo, aiCompletion, messagingApi, gateway, handoff, labelRepo, convLabelRepo, eventRepo, orderRepo, orderHandler, process.env.NODE_ENV !== 'local' ? 'https://asis.chat/api' : 'http://localhost:3007/api'),
    inject: ['ConversationRepository', 'MessageRepository', 'ContactRepository', 'PhoneNumberRepository', 'AgentRepository', 'AiAgentConfigRepository', 'AiUsageRepository', 'AiCompletionPort', 'MessagingApiPort', 'RealtimeGatewayPort', 'HandoffToHumanUseCase', 'LabelRepository', 'ConversationLabelRepository', 'ConversationEventRepository', 'OrderRepository', OrderDirectiveHandler],
  },

  // Label
  {
    provide: 'CreateLabelUseCase',
    useFactory: (labelRepo: any) => new CreateLabelUseCase(labelRepo),
    inject: ['LabelRepository'],
  },
  {
    provide: 'ListLabelsUseCase',
    useFactory: (labelRepo: any) => new ListLabelsUseCase(labelRepo),
    inject: ['LabelRepository'],
  },
  {
    provide: 'UpdateLabelUseCase',
    useFactory: (labelRepo: any) => new UpdateLabelUseCase(labelRepo),
    inject: ['LabelRepository'],
  },
  {
    provide: 'DeleteLabelUseCase',
    useFactory: (labelRepo: any, convLabelRepo: any, gateway: any) =>
      new DeleteLabelUseCase(labelRepo, convLabelRepo, gateway),
    inject: ['LabelRepository', 'ConversationLabelRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'AssignLabelUseCase',
    useFactory: (convLabelRepo: any, convRepo: any, labelRepo: any, agentRepo: any, eventRepo: any, gateway: any) =>
      new AssignLabelUseCase(convLabelRepo, convRepo, labelRepo, agentRepo, eventRepo, gateway),
    inject: ['ConversationLabelRepository', 'ConversationRepository', 'LabelRepository', 'AgentRepository', 'ConversationEventRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'RemoveLabelUseCase',
    useFactory: (convLabelRepo: any, convRepo: any, labelRepo: any, agentRepo: any, eventRepo: any, gateway: any) =>
      new RemoveLabelUseCase(convLabelRepo, convRepo, labelRepo, agentRepo, eventRepo, gateway),
    inject: ['ConversationLabelRepository', 'ConversationRepository', 'LabelRepository', 'AgentRepository', 'ConversationEventRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'GetConversationLabelsUseCase',
    useFactory: (convLabelRepo: any, labelRepo: any) =>
      new GetConversationLabelsUseCase(convLabelRepo, labelRepo),
    inject: ['ConversationLabelRepository', 'LabelRepository'],
  },

  // Order
  {
    provide: 'CreateOrderUseCase',
    useFactory: (orderRepo: any, eventRepo: any, gateway: any) =>
      new CreateOrderUseCase(orderRepo, eventRepo, gateway),
    inject: ['OrderRepository', 'ConversationEventRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'ListOrdersUseCase',
    useFactory: (orderRepo: any) => new ListOrdersUseCase(orderRepo),
    inject: ['OrderRepository'],
  },
  {
    provide: 'GetOrderUseCase',
    useFactory: (orderRepo: any) => new GetOrderUseCase(orderRepo),
    inject: ['OrderRepository'],
  },
  {
    provide: 'NotifyOrderStatusUseCase',
    useFactory: (convRepo: any, contactRepo: any, phoneRepo: any, msgRepo: any, agentRepo: any, configRepo: any, aiCompletion: any, messagingApi: any, gateway: any) =>
      new NotifyOrderStatusUseCase(convRepo, contactRepo, phoneRepo, msgRepo, agentRepo, configRepo, aiCompletion, messagingApi, gateway),
    inject: ['ConversationRepository', 'ContactRepository', 'PhoneNumberRepository', 'MessageRepository', 'AgentRepository', 'AiAgentConfigRepository', 'AiCompletionPort', 'MessagingApiPort', 'RealtimeGatewayPort'],
  },
  {
    provide: 'UpdateOrderStatusUseCase',
    useFactory: (orderRepo: any, gateway: any, notifyOrderStatus: any) => new UpdateOrderStatusUseCase(orderRepo, gateway, notifyOrderStatus),
    inject: ['OrderRepository', 'RealtimeGatewayPort', 'NotifyOrderStatusUseCase'],
  },

  // Billing
  {
    provide: 'EnforcePlanLimitsUseCase',
    useFactory: (subRepo: any, phoneRepo: any, agentRepo: any, aiConfigRepo: any) =>
      new EnforcePlanLimitsUseCase(subRepo, phoneRepo, agentRepo, aiConfigRepo),
    inject: ['SubscriptionRepository', 'PhoneNumberRepository', 'AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'ToggleResourceUseCase',
    useFactory: (subRepo: any, phoneRepo: any, agentRepo: any, aiConfigRepo: any) =>
      new ToggleResourceUseCase(subRepo, phoneRepo, agentRepo, aiConfigRepo),
    inject: ['SubscriptionRepository', 'PhoneNumberRepository', 'AgentRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'SubscribeUseCase',
    useFactory: (subRepo: any, billingRepo: any, enforce: any) => new SubscribeUseCase(subRepo, billingRepo, enforce),
    inject: ['SubscriptionRepository', 'BillingRecordRepository', 'EnforcePlanLimitsUseCase'],
  },
  {
    provide: 'ChangePlanUseCase',
    useFactory: (subRepo: any, billingRepo: any, enforce: any) => new ChangePlanUseCase(subRepo, billingRepo, enforce),
    inject: ['SubscriptionRepository', 'BillingRecordRepository', 'EnforcePlanLimitsUseCase'],
  },
  {
    provide: 'CancelSubscriptionUseCase',
    useFactory: (subRepo: any, billingRepo: any, enforce: any, paymentProvider: any) => new CancelSubscriptionUseCase(subRepo, billingRepo, enforce, paymentProvider),
    inject: ['SubscriptionRepository', 'BillingRecordRepository', 'EnforcePlanLimitsUseCase', 'PaymentProviderPort'],
  },
  {
    provide: 'GetSubscriptionUseCase',
    useFactory: (subRepo: any, billingRepo: any, enforce: any) => new GetSubscriptionUseCase(subRepo, billingRepo, enforce),
    inject: ['SubscriptionRepository', 'BillingRecordRepository', 'EnforcePlanLimitsUseCase'],
  },
  {
    provide: 'GetBillingHistoryUseCase',
    useFactory: (billingRepo: any) => new GetBillingHistoryUseCase(billingRepo),
    inject: ['BillingRecordRepository'],
  },
  {
    provide: 'CheckPlanLimitUseCase',
    useFactory: (subRepo: any, phoneRepo: any, agentRepo: any, convRepo: any, aiConfigRepo: any) =>
      new CheckPlanLimitUseCase(subRepo, phoneRepo, agentRepo, convRepo, aiConfigRepo),
    inject: ['SubscriptionRepository', 'PhoneNumberRepository', 'AgentRepository', 'ConversationRepository', 'AiAgentConfigRepository'],
  },
  {
    provide: 'CreateCheckoutUseCase',
    useFactory: (subRepo: any, agentRepo: any, paymentProvider: any, providerResolver: any) =>
      new CreateCheckoutUseCase(subRepo, agentRepo, paymentProvider, providerResolver),
    inject: ['SubscriptionRepository', 'AgentRepository', 'PaymentProviderPort', 'PaymentProviderResolverPort'],
  },
  {
    provide: 'HandlePaymentWebhookUseCase',
    useFactory: (subRepo: any, billingRepo: any, enforce: any) =>
      new HandlePaymentWebhookUseCase(subRepo, billingRepo, enforce),
    inject: ['SubscriptionRepository', 'BillingRecordRepository', 'EnforcePlanLimitsUseCase'],
  },

  // Order Directive Handler
  {
    provide: OrderDirectiveHandler,
    useFactory: (createOrder: any) => new OrderDirectiveHandler(createOrder),
    inject: ['CreateOrderUseCase'],
  },
];

@Module({
  imports: [InfrastructureModule],
  controllers: [
    AuthController,
    AgentController,
    PhoneNumberController,
    ConversationController,
    TenantController,
    WebhookController,
    ContactController,
    AiAgentController,
    LabelController,
    OrderController,
    BillingController,
    PaymentWebhookController,
  ],
  providers: [
    ...useCaseProviders,
    WebhookJobProcessor,
    AiResponseJobProcessor,
    EmailJobProcessor,
    PlanLimitGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DemoGuard },
  ],
})
export class PresentationModule {}
