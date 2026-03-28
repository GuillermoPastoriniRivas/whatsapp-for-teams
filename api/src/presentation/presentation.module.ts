import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

// Controllers
import { AuthController } from './controllers/auth.controller.js';
import { AgentController } from './controllers/agent.controller.js';
import { PhoneNumberController } from './controllers/phone-number.controller.js';
import { ConversationController } from './controllers/conversation.controller.js';
import { TenantController } from './controllers/tenant.controller.js';
import { WebhookController } from './controllers/webhook.controller.js';

// Use Cases — Auth
import { LoginUseCase } from '../application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from '../application/use-cases/auth/refresh-token.use-case.js';
import { GetCurrentAgentUseCase } from '../application/use-cases/auth/get-current-agent.use-case.js';

// Use Cases — Agent
import { CreateAgentUseCase } from '../application/use-cases/agent/create-agent.use-case.js';
import { ListAgentsUseCase } from '../application/use-cases/agent/list-agents.use-case.js';
import { UpdateAgentStatusUseCase } from '../application/use-cases/agent/update-agent-status.use-case.js';
import { GrantPhoneAccessUseCase } from '../application/use-cases/agent/grant-phone-access.use-case.js';
import { RevokePhoneAccessUseCase } from '../application/use-cases/agent/revoke-phone-access.use-case.js';
import { GetAgentPhoneAccessUseCase } from '../application/use-cases/agent/get-agent-phone-access.use-case.js';

// Use Cases — Phone Number
import { RegisterPhoneNumberUseCase } from '../application/use-cases/phone-number/register-phone-number.use-case.js';
import { ListPhoneNumbersUseCase } from '../application/use-cases/phone-number/list-phone-numbers.use-case.js';
import { UpdatePhoneNumberUseCase } from '../application/use-cases/phone-number/update-phone-number.use-case.js';

// Use Cases — Conversation
import { ListConversationsUseCase } from '../application/use-cases/conversation/list-conversations.use-case.js';
import { GetConversationDetailUseCase } from '../application/use-cases/conversation/get-conversation-detail.use-case.js';
import { GetConversationMessagesUseCase } from '../application/use-cases/conversation/get-conversation-messages.use-case.js';
import { SendMessageUseCase } from '../application/use-cases/conversation/send-message.use-case.js';
import { AssignConversationUseCase } from '../application/use-cases/conversation/assign-conversation.use-case.js';
import { AutoAssignConversationUseCase } from '../application/use-cases/conversation/auto-assign-conversation.use-case.js';
import { ResolveConversationUseCase } from '../application/use-cases/conversation/resolve-conversation.use-case.js';
import { GetConversationEventsUseCase } from '../application/use-cases/conversation/get-conversation-events.use-case.js';

// Use Cases — Tenant
import { CreateTenantUseCase } from '../application/use-cases/tenant/create-tenant.use-case.js';
import { GetTenantUseCase } from '../application/use-cases/tenant/get-tenant.use-case.js';

// Use Cases — Webhook
import { HandleInboundMessageUseCase } from '../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../application/use-cases/webhook/handle-status-update.use-case.js';

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

  // Agent
  {
    provide: 'CreateAgentUseCase',
    useFactory: (agentRepo: any, hasher: any) => new CreateAgentUseCase(agentRepo, hasher),
    inject: ['AgentRepository', 'PasswordHasherPort'],
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
    provide: 'ResolveConversationUseCase',
    useFactory: (convRepo: any, agentRepo: any, gateway: any, eventRepo: any) =>
      new ResolveConversationUseCase(convRepo, agentRepo, gateway, eventRepo),
    inject: ['ConversationRepository', 'AgentRepository', 'RealtimeGatewayPort', 'ConversationEventRepository'],
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

  // Webhook
  {
    provide: 'HandleInboundMessageUseCase',
    useFactory: (phoneRepo: any, contactRepo: any, convRepo: any, msgRepo: any, gateway: any, autoAssign: any, eventRepo: any) =>
      new HandleInboundMessageUseCase(phoneRepo, contactRepo, convRepo, msgRepo, gateway, autoAssign, eventRepo),
    inject: ['PhoneNumberRepository', 'ContactRepository', 'ConversationRepository', 'MessageRepository', 'RealtimeGatewayPort', 'AutoAssignConversationUseCase', 'ConversationEventRepository'],
  },
  {
    provide: 'HandleStatusUpdateUseCase',
    useFactory: (msgRepo: any, gateway: any) => new HandleStatusUpdateUseCase(msgRepo, gateway),
    inject: ['MessageRepository', 'RealtimeGatewayPort'],
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
  ],
  providers: [
    ...useCaseProviders,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class PresentationModule {}
