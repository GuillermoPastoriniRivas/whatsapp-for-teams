import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';

// Media library
import { MediaController } from './controllers/media.controller.js';
import { MediaAccessService } from '../application/use-cases/media/media-access.service.js';
import { MediaStorageService } from '../application/use-cases/media/media-storage.service.js';
import { RegisterInboundMediaUseCase } from '../application/use-cases/media/register-inbound-media.use-case.js';
import { IngestMediaAssetUseCase } from '../application/use-cases/media/ingest-media-asset.use-case.js';
import { UploadMediaUseCase } from '../application/use-cases/media/upload-media.use-case.js';
import { ListMediaUseCase } from '../application/use-cases/media/list-media.use-case.js';
import { GetMediaUsageUseCase } from '../application/use-cases/media/get-media-usage.use-case.js';
import { UpdateMediaUseCase } from '../application/use-cases/media/update-media.use-case.js';
import { DeleteMediaUseCase } from '../application/use-cases/media/delete-media.use-case.js';
import { BackfillTenantMediaUseCase } from '../application/use-cases/media/backfill-tenant-media.use-case.js';
import { MediaMaintenanceUseCase } from '../application/use-cases/media/media-maintenance.use-case.js';
import { MessageMediaEnricher } from '../application/use-cases/media/message-media.enricher.js';
import { MediaJobProcessor } from '../infrastructure/queue/media-job.processor.js';

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
import { AccountProfileController } from './controllers/account-profile.controller.js';
import { GetAccountProfileUseCase, UpdateAccountProfileUseCase } from '../application/use-cases/tenant/account-profile.use-cases.js';
import { WebhookController } from './controllers/webhook.controller.js';
import { ContactController } from './controllers/contact.controller.js';
import { TemplateController } from './controllers/template.controller.js';
import { CampaignController } from './controllers/campaign.controller.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import {
  GetTemplateAnalyticsUseCase,
  GetWhatsAppAnalyticsUseCase,
} from '../application/use-cases/analytics/get-whatsapp-analytics.use-case.js';
import { GetAdPerformanceUseCase } from '../application/use-cases/analytics/get-ad-performance.use-case.js';

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
import { SetPasswordUseCase } from '../application/use-cases/auth/set-password.use-case.js';

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
import { GetBusinessProfileUseCase } from '../application/use-cases/phone-number/get-business-profile.use-case.js';
import { UpdateBusinessProfileUseCase } from '../application/use-cases/phone-number/update-business-profile.use-case.js';
import { UpdateProfilePictureUseCase } from '../application/use-cases/phone-number/update-profile-picture.use-case.js';
import {
  GetConversationalComponentsUseCase,
  UpdateConversationalComponentsUseCase,
} from '../application/use-cases/phone-number/conversational-components.use-case.js';
import {
  RegisterPhoneNumberOnMetaUseCase,
  SyncPhoneNumberUseCase,
} from '../application/use-cases/phone-number/phone-registration.use-case.js';
import {
  BlockUsersUseCase,
  ListBlockedUsersUseCase,
} from '../application/use-cases/phone-number/blocked-users.use-case.js';

// Use Cases — Conversation
import { ListConversationsUseCase } from '../application/use-cases/conversation/list-conversations.use-case.js';
import { GetConversationDetailUseCase } from '../application/use-cases/conversation/get-conversation-detail.use-case.js';
import { GetConversationMessagesUseCase } from '../application/use-cases/conversation/get-conversation-messages.use-case.js';
import { SendMessageUseCase } from '../application/use-cases/conversation/send-message.use-case.js';
import { SendTemplateMessageUseCase } from '../application/use-cases/conversation/send-template-message.use-case.js';
import { MarkConversationReadUseCase } from '../application/use-cases/conversation/mark-conversation-read.use-case.js';
import { ReactToMessageUseCase } from '../application/use-cases/conversation/react-to-message.use-case.js';
import { AssignConversationUseCase } from '../application/use-cases/conversation/assign-conversation.use-case.js';
import { AutoAssignConversationUseCase } from '../application/use-cases/conversation/auto-assign-conversation.use-case.js';
import { SetAutopilotUseCase } from '../application/use-cases/conversation/set-autopilot.use-case.js';
import { GetConversationEventsUseCase } from '../application/use-cases/conversation/get-conversation-events.use-case.js';
import { AddConversationNoteUseCase } from '../application/use-cases/conversation/add-conversation-note.use-case.js';
import { GetConversationNotesUseCase } from '../application/use-cases/conversation/get-conversation-notes.use-case.js';
import { DemoAiReplyUseCase } from '../application/use-cases/conversation/demo-ai-reply.use-case.js';

// Use Cases — Contact
import { UpdateContactUseCase } from '../application/use-cases/contact/update-contact.use-case.js';
import { ListContactsUseCase } from '../application/use-cases/contact/list-contacts.use-case.js';
import { ImportContactsUseCase } from '../application/use-cases/contact/import-contacts.use-case.js';
import { CreateContactUseCase } from '../application/use-cases/contact/create-contact.use-case.js';

// Use Cases — Template
import { CreateTemplateUseCase } from '../application/use-cases/template/create-template.use-case.js';
import { UpdateTemplateUseCase } from '../application/use-cases/template/update-template.use-case.js';
import { DeleteTemplateUseCase } from '../application/use-cases/template/delete-template.use-case.js';
import { ListTemplatesUseCase } from '../application/use-cases/template/list-templates.use-case.js';
import { ListWhatsAppFlowsUseCase } from '../application/use-cases/flow/list-whatsapp-flows.use-case.js';
import { GetTemplateUseCase } from '../application/use-cases/template/get-template.use-case.js';
import { SyncTemplatesUseCase } from '../application/use-cases/template/sync-templates.use-case.js';

// Use Cases — Campaign
import { CreateCampaignUseCase } from '../application/use-cases/campaign/create-campaign.use-case.js';
import { UpdateCampaignUseCase } from '../application/use-cases/campaign/update-campaign.use-case.js';
import { StartCampaignUseCase } from '../application/use-cases/campaign/start-campaign.use-case.js';
import { PauseCampaignUseCase } from '../application/use-cases/campaign/pause-campaign.use-case.js';
import { ResumeCampaignUseCase } from '../application/use-cases/campaign/resume-campaign.use-case.js';
import { CancelCampaignUseCase } from '../application/use-cases/campaign/cancel-campaign.use-case.js';
import { DeleteCampaignUseCase } from '../application/use-cases/campaign/delete-campaign.use-case.js';
import { ListCampaignsUseCase } from '../application/use-cases/campaign/list-campaigns.use-case.js';
import { GetCampaignUseCase } from '../application/use-cases/campaign/get-campaign.use-case.js';
import { ListCampaignRecipientsUseCase } from '../application/use-cases/campaign/list-campaign-recipients.use-case.js';
import { GetCampaignStatsUseCase } from '../application/use-cases/campaign/get-campaign-stats.use-case.js';
import { ProcessCampaignBatchUseCase } from '../application/use-cases/campaign/process-campaign-batch.use-case.js';
import { AttributeCampaignReplyUseCase } from '../application/use-cases/campaign/attribute-campaign-reply.use-case.js';

// Use Cases — Tenant
import { CreateTenantUseCase } from '../application/use-cases/tenant/create-tenant.use-case.js';
import { GetTenantUseCase } from '../application/use-cases/tenant/get-tenant.use-case.js';

// Use Cases — Webhook
import { HandleInboundMessageUseCase } from '../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleUserIdUpdateUseCase } from '../application/use-cases/webhook/handle-user-id-update.use-case.js';
import { HandleAccountEventUseCase } from '../application/use-cases/webhook/handle-account-event.use-case.js';
import { HandleUserPreferenceUseCase } from '../application/use-cases/webhook/handle-user-preference.use-case.js';
import { ResolveContactIdentityUseCase } from '../application/use-cases/contact/resolve-contact-identity.use-case.js';
import { HandleStatusUpdateUseCase } from '../application/use-cases/webhook/handle-status-update.use-case.js';
import { HandleTemplateStatusUpdateUseCase } from '../application/use-cases/webhook/handle-template-status-update.use-case.js';
import { HandleTemplateQualityUpdateUseCase } from '../application/use-cases/webhook/handle-template-quality-update.use-case.js';
import { HandleTemplateCategoryUpdateUseCase } from '../application/use-cases/webhook/handle-template-category-update.use-case.js';

// Use Cases — AI Agent
import { ProcessAiResponseUseCase } from '../application/use-cases/ai/process-ai-response.use-case.js';
import { HandoffToHumanUseCase } from '../application/use-cases/ai/handoff-to-human.use-case.js';

// Use Cases — Label
import { CreateLabelUseCase } from '../application/use-cases/label/create-label.use-case.js';
import { ListLabelsUseCase } from '../application/use-cases/label/list-labels.use-case.js';
import { UpdateLabelUseCase } from '../application/use-cases/label/update-label.use-case.js';
import { DeleteLabelUseCase } from '../application/use-cases/label/delete-label.use-case.js';
import { AssignLabelUseCase } from '../application/use-cases/label/assign-label.use-case.js';
import { RemoveLabelUseCase } from '../application/use-cases/label/remove-label.use-case.js';
import { GetConversationLabelsUseCase } from '../application/use-cases/label/get-conversation-labels.use-case.js';

// Controllers — AI

// Controllers — Label
import { LabelController } from './controllers/label.controller.js';

// Controllers — Billing
import { BillingController } from './controllers/billing.controller.js';
import { PaymentWebhookController } from './controllers/payment-webhook.controller.js';

// Controllers — Notifications
import { NotificationController } from './controllers/notification.controller.js';

// Use Cases — Notifications
import { SubscribePushUseCase } from '../application/use-cases/notification/subscribe-push.use-case.js';
import { UnsubscribePushUseCase } from '../application/use-cases/notification/unsubscribe-push.use-case.js';
import { SendPushToAgentUseCase } from '../application/use-cases/notification/send-push-to-agent.use-case.js';

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

// Developer platform (API pública + webhooks)
import { DeveloperController } from './controllers/developer.controller.js';
import { PublicApiController } from './controllers/public-api.controller.js';
import { PublicFlowsController } from './controllers/public-flows.controller.js';
import { McpController } from './mcp/mcp.controller.js';
import { AsisMcpServerFactory } from './mcp/asis-mcp-server.factory.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';
import { GetDeveloperOverviewUseCase } from '../application/use-cases/developer/get-developer-overview.use-case.js';
import { CreateApiKeyUseCase } from '../application/use-cases/developer/create-api-key.use-case.js';
import { ListApiKeysUseCase } from '../application/use-cases/developer/list-api-keys.use-case.js';
import { RevokeApiKeyUseCase } from '../application/use-cases/developer/revoke-api-key.use-case.js';
import { AuthenticateApiKeyUseCase } from '../application/use-cases/developer/authenticate-api-key.use-case.js';
import { CreateWebhookEndpointUseCase } from '../application/use-cases/developer/create-webhook-endpoint.use-case.js';
import { UpdateWebhookEndpointUseCase } from '../application/use-cases/developer/update-webhook-endpoint.use-case.js';
import { DeleteWebhookEndpointUseCase } from '../application/use-cases/developer/delete-webhook-endpoint.use-case.js';
import { ListWebhookEndpointsUseCase } from '../application/use-cases/developer/list-webhook-endpoints.use-case.js';
import { RotateWebhookSecretUseCase } from '../application/use-cases/developer/rotate-webhook-secret.use-case.js';
import { ListWebhookDeliveriesUseCase } from '../application/use-cases/developer/list-webhook-deliveries.use-case.js';
import { RetryWebhookDeliveryUseCase } from '../application/use-cases/developer/retry-webhook-delivery.use-case.js';
import { SendTestWebhookUseCase } from '../application/use-cases/developer/send-test-webhook.use-case.js';
import { DeliverWebhookUseCase } from '../application/use-cases/developer/deliver-webhook.use-case.js';
import { SendApiMessageUseCase } from '../application/use-cases/developer/send-api-message.use-case.js';
import { DeveloperWebhookJobProcessor } from '../infrastructure/queue/developer-webhook-job.processor.js';

// Queue Processors
import { WebhookJobProcessor } from '../infrastructure/queue/webhook-job.processor.js';
import { AiResponseJobProcessor } from '../infrastructure/queue/ai-response-job.processor.js';
import { EmailJobProcessor } from '../infrastructure/queue/email-job.processor.js';
import { CampaignJobProcessor } from '../infrastructure/queue/campaign-job.processor.js';
import { FlowJobProcessor } from '../infrastructure/queue/flow-job.processor.js';

// Flows
import { FlowController, FlowExecutionController, FlowConnectionController } from './controllers/flow.controller.js';
import { FlowWebhookController } from './controllers/flow-webhook.controller.js';
import { FlowEngineService } from '../application/use-cases/flow/engine/flow-engine.service.js';
import { SimulateFlowUseCase } from '../application/use-cases/flow/simulator/simulate-flow.use-case.js';
import { SetupAssistantUseCase } from '../application/use-cases/flow/assistant/setup-assistant.use-case.js';
import { FlowInboundRouterUseCase } from '../application/use-cases/flow/flow-inbound-router.use-case.js';
import { CancelActiveFlowExecutionUseCase } from '../application/use-cases/flow/cancel-active-flow-execution.use-case.js';
import { StartFlowFromWebhookUseCase } from '../application/use-cases/flow/start-flow-from-webhook.use-case.js';
import { CreateFlowUseCase } from '../application/use-cases/flow/create-flow.use-case.js';
import { ListFlowsUseCase } from '../application/use-cases/flow/list-flows.use-case.js';
import { GetFlowUseCase } from '../application/use-cases/flow/get-flow.use-case.js';
import { UpdateFlowUseCase } from '../application/use-cases/flow/update-flow.use-case.js';
import { PublishFlowUseCase } from '../application/use-cases/flow/publish-flow.use-case.js';
import { CheckFlowUseCase } from '../application/use-cases/flow/check-flow.use-case.js';
import { EnsureDefaultPhoneFlowUseCase } from '../application/use-cases/flow/ensure-default-phone-flow.use-case.js';
import {
  PauseFlowUseCase, ActivateFlowUseCase, ArchiveFlowUseCase, RegenerateWebhookTokenUseCase,
} from '../application/use-cases/flow/flow-lifecycle.use-cases.js';
import {
  ListFlowExecutionsUseCase, GetFlowExecutionUseCase, CancelFlowExecutionUseCase,
  GetActiveFlowForConversationUseCase, GetFlowStatsUseCase, GetFlowVersionsUseCase, GetFlowVersionUseCase,
} from '../application/use-cases/flow/flow-executions.use-cases.js';
import {
  CreateFlowConnectionUseCase, ListFlowConnectionsUseCase, DeleteFlowConnectionUseCase,
} from '../application/use-cases/flow/flow-connections.use-cases.js';
import { GetMessageUsageUseCase } from '../application/use-cases/billing/get-message-usage.use-case.js';
import { RateChargesUseCase } from '../application/use-cases/billing/rate-charges.use-case.js';
import { ReconcileMetaUsageUseCase } from '../application/use-cases/billing/reconcile-meta-usage.use-case.js';
import { BillingJobProcessor } from '../infrastructure/queue/billing-job.processor.js';

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
  {
    provide: 'SetPasswordUseCase',
    useFactory: (agentRepo: any, refreshTokenRepo: any, resetTokenRepo: any, hasher: any, tokenProvider: any) =>
      new SetPasswordUseCase(agentRepo, refreshTokenRepo, resetTokenRepo, hasher, tokenProvider),
    inject: ['AgentRepository', 'RefreshTokenRepository', 'PasswordResetTokenRepository', 'PasswordHasherPort', 'TokenProviderPort'],
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
    provide: 'GetAccountProfileUseCase',
    useFactory: (tenantRepo: any) => new GetAccountProfileUseCase(tenantRepo),
    inject: ['TenantRepository'],
  },
  {
    provide: 'UpdateAccountProfileUseCase',
    useFactory: (tenantRepo: any) => new UpdateAccountProfileUseCase(tenantRepo),
    inject: ['TenantRepository'],
  },
  {
    provide: 'SetAutopilotUseCase',
    useFactory: (convRepo: any, execRepo: any, flowRepo: any, eventRepo: any, gateway: any, jobQueue: any) =>
      new SetAutopilotUseCase(convRepo, execRepo, flowRepo, eventRepo, gateway, jobQueue),
    inject: ['ConversationRepository', 'FlowExecutionRepository', 'FlowRepository', 'ConversationEventRepository', 'RealtimeGatewayPort', 'JobQueuePort'],
  },
  {
    provide: 'AutoAssignConversationUseCase',
    useFactory: (convRepo: any, agentRepo: any, accessRepo: any, gateway: any, eventRepo: any, devEvents: any) =>
      new AutoAssignConversationUseCase(convRepo, agentRepo, accessRepo, gateway, eventRepo, devEvents),
    inject: ['ConversationRepository', 'AgentRepository', 'AgentPhoneAccessRepository', 'RealtimeGatewayPort', 'ConversationEventRepository', 'DeveloperEventsPort'],
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
    useFactory: (phoneRepo: any, ensureDefaultFlow: any) => new RegisterPhoneNumberUseCase(phoneRepo, ensureDefaultFlow),
    inject: ['PhoneNumberRepository', 'EnsureDefaultPhoneFlowUseCase'],
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
    provide: 'GetBusinessProfileUseCase',
    useFactory: (phoneRepo: any, profileApi: any) => new GetBusinessProfileUseCase(phoneRepo, profileApi),
    inject: ['PhoneNumberRepository', 'BusinessProfilePort'],
  },
  {
    provide: 'UpdateBusinessProfileUseCase',
    useFactory: (phoneRepo: any, profileApi: any) => new UpdateBusinessProfileUseCase(phoneRepo, profileApi),
    inject: ['PhoneNumberRepository', 'BusinessProfilePort'],
  },
  {
    provide: 'UpdateProfilePictureUseCase',
    useFactory: (phoneRepo: any, profileApi: any) => new UpdateProfilePictureUseCase(phoneRepo, profileApi),
    inject: ['PhoneNumberRepository', 'BusinessProfilePort'],
  },
  {
    provide: 'GetConversationalComponentsUseCase',
    useFactory: (phoneRepo: any, admin: any) => new GetConversationalComponentsUseCase(phoneRepo, admin),
    inject: ['PhoneNumberRepository', 'PhoneAdminPort'],
  },
  {
    provide: 'UpdateConversationalComponentsUseCase',
    useFactory: (phoneRepo: any, admin: any) => new UpdateConversationalComponentsUseCase(phoneRepo, admin),
    inject: ['PhoneNumberRepository', 'PhoneAdminPort'],
  },
  {
    provide: 'SyncPhoneNumberUseCase',
    useFactory: (phoneRepo: any, admin: any) => new SyncPhoneNumberUseCase(phoneRepo, admin),
    inject: ['PhoneNumberRepository', 'PhoneAdminPort'],
  },
  {
    provide: 'RegisterPhoneNumberOnMetaUseCase',
    useFactory: (phoneRepo: any, admin: any, sync: any) =>
      new RegisterPhoneNumberOnMetaUseCase(phoneRepo, admin, sync),
    inject: ['PhoneNumberRepository', 'PhoneAdminPort', 'SyncPhoneNumberUseCase'],
  },
  {
    provide: 'GetWhatsAppAnalyticsUseCase',
    useFactory: (phoneRepo: any, analytics: any) => new GetWhatsAppAnalyticsUseCase(phoneRepo, analytics),
    inject: ['PhoneNumberRepository', 'WhatsAppAnalyticsPort'],
  },
  {
    provide: 'GetAdPerformanceUseCase',
    useFactory: (conversationRepo: any, chargeRepo: any) =>
      new GetAdPerformanceUseCase(conversationRepo, chargeRepo),
    inject: ['ConversationRepository', 'MessageChargeRepository'],
  },
  {
    provide: 'GetTemplateAnalyticsUseCase',
    useFactory: (phoneRepo: any, templateRepo: any, analytics: any) =>
      new GetTemplateAnalyticsUseCase(phoneRepo, templateRepo, analytics),
    inject: ['PhoneNumberRepository', 'MessageTemplateRepository', 'WhatsAppAnalyticsPort'],
  },
  {
    provide: 'ListBlockedUsersUseCase',
    useFactory: (phoneRepo: any, contactRepo: any, admin: any) =>
      new ListBlockedUsersUseCase(phoneRepo, contactRepo, admin),
    inject: ['PhoneNumberRepository', 'ContactRepository', 'PhoneAdminPort'],
  },
  {
    provide: 'BlockUsersUseCase',
    useFactory: (phoneRepo: any, admin: any) => new BlockUsersUseCase(phoneRepo, admin),
    inject: ['PhoneNumberRepository', 'PhoneAdminPort'],
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
    useFactory: (msgRepo: any, convRepo: any, mediaEnricher: any) =>
      new GetConversationMessagesUseCase(msgRepo, convRepo, mediaEnricher),
    inject: ['MessageRepository', 'ConversationRepository', 'MessageMediaEnricher'],
  },
  {
    provide: 'SendMessageUseCase',
    useFactory: (convRepo: any, msgRepo: any, contactRepo: any, phoneRepo: any, messagingApi: any, gateway: any, agentRepo: any, setAutopilot: any, devEvents: any, assetRepo: any, mediaAccess: any, mediaEnricher: any) =>
      new SendMessageUseCase(convRepo, msgRepo, contactRepo, phoneRepo, messagingApi, gateway, agentRepo, setAutopilot, devEvents, assetRepo, mediaAccess, mediaEnricher),
    inject: ['ConversationRepository', 'MessageRepository', 'ContactRepository', 'PhoneNumberRepository', 'MessagingApiPort', 'RealtimeGatewayPort', 'AgentRepository', 'SetAutopilotUseCase', 'DeveloperEventsPort', 'MediaAssetRepository', 'MediaAccessService', 'MessageMediaEnricher'],
  },
  {
    provide: 'MarkConversationReadUseCase',
    useFactory: (convRepo: any, gateway: any, msgRepo: any, phoneRepo: any, messagingApi: any) =>
      new MarkConversationReadUseCase(convRepo, gateway, msgRepo, phoneRepo, messagingApi),
    inject: ['ConversationRepository', 'RealtimeGatewayPort', 'MessageRepository', 'PhoneNumberRepository', 'MessagingApiPort'],
  },
  {
    provide: 'ReactToMessageUseCase',
    useFactory: (convRepo: any, msgRepo: any, contactRepo: any, phoneRepo: any, agentRepo: any, messagingApi: any, gateway: any) =>
      new ReactToMessageUseCase(convRepo, msgRepo, contactRepo, phoneRepo, agentRepo, messagingApi, gateway),
    inject: ['ConversationRepository', 'MessageRepository', 'ContactRepository', 'PhoneNumberRepository', 'AgentRepository', 'MessagingApiPort', 'RealtimeGatewayPort'],
  },
  {
    provide: 'SendTemplateMessageUseCase',
    useFactory: (convRepo: any, templateRepo: any, msgRepo: any, contactRepo: any, phoneRepo: any, agentRepo: any, messagingApi: any, gateway: any, devEvents: any) =>
      new SendTemplateMessageUseCase(convRepo, templateRepo, msgRepo, contactRepo, phoneRepo, agentRepo, messagingApi, gateway, devEvents),
    inject: ['ConversationRepository', 'MessageTemplateRepository', 'MessageRepository', 'ContactRepository', 'PhoneNumberRepository', 'AgentRepository', 'MessagingApiPort', 'RealtimeGatewayPort', 'DeveloperEventsPort'],
  },
  {
    provide: 'AssignConversationUseCase',
    useFactory: (convRepo: any, agentRepo: any, gateway: any, eventRepo: any, sendPush: any, cancelFlow: any, devEvents: any) =>
      new AssignConversationUseCase(convRepo, agentRepo, gateway, eventRepo, sendPush, cancelFlow, devEvents),
    inject: ['ConversationRepository', 'AgentRepository', 'RealtimeGatewayPort', 'ConversationEventRepository', 'SendPushToAgentUseCase', 'CancelActiveFlowExecutionUseCase', 'DeveloperEventsPort'],
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
  {
    provide: 'ImportContactsUseCase',
    useFactory: (contactRepo: any) => new ImportContactsUseCase(contactRepo),
    inject: ['ContactRepository'],
  },
  {
    provide: 'CreateContactUseCase',
    useFactory: (contactRepo: any) => new CreateContactUseCase(contactRepo),
    inject: ['ContactRepository'],
  },

  // Flow
  {
    provide: 'FlowEngineService',
    useFactory: (
      flowRepo: any, versionRepo: any, execRepo: any, statRepo: any, connectionRepo: any,
      convRepo: any, contactRepo: any, phoneRepo: any, agentRepo: any, tenantRepo: any,
      usageRepo: any, msgRepo: any, labelRepo: any, convLabelRepo: any, noteRepo: any,
      eventRepo: any, templateRepo: any, secrets: any, http: any, messagingApi: any,
      aiCompletion: any, gateway: any, jobQueue: any, autoAssign: any,
      devEvents: any, accessRepo: any, assetRepo: any, mediaAccess: any,
    ) =>
      new FlowEngineService(
        flowRepo, versionRepo, execRepo, statRepo, connectionRepo,
        convRepo, contactRepo, phoneRepo, agentRepo, tenantRepo,
        usageRepo, msgRepo, labelRepo, convLabelRepo, noteRepo,
        eventRepo, templateRepo, secrets, http, messagingApi,
        aiCompletion, gateway, jobQueue, autoAssign,
        devEvents, accessRepo, assetRepo, mediaAccess,
      ),
    inject: [
      'FlowRepository', 'FlowVersionRepository', 'FlowExecutionRepository', 'FlowNodeStatRepository', 'FlowConnectionRepository',
      'ConversationRepository', 'ContactRepository', 'PhoneNumberRepository', 'AgentRepository', 'TenantRepository',
      'AiUsageRepository', 'MessageRepository', 'LabelRepository', 'ConversationLabelRepository', 'ConversationNoteRepository',
      'ConversationEventRepository', 'MessageTemplateRepository', 'FlowSecretsPort', 'FlowHttpPort', 'MessagingApiPort',
      'AiCompletionPort', 'RealtimeGatewayPort', 'JobQueuePort', 'AutoAssignConversationUseCase',
      'DeveloperEventsPort', 'AgentPhoneAccessRepository', 'MediaAssetRepository', 'MediaAccessService',
    ],
  },
  {
    provide: 'FlowInboundRouterUseCase',
    useFactory: (flowRepo: any, versionRepo: any, execRepo: any, agentRepo: any, msgRepo: any, eventRepo: any, gateway: any, jobQueue: any, devEvents: any, autoAssign: any, convLabelRepo: any) =>
      new FlowInboundRouterUseCase(flowRepo, versionRepo, execRepo, agentRepo, msgRepo, eventRepo, gateway, jobQueue, devEvents, autoAssign, convLabelRepo),
    inject: ['FlowRepository', 'FlowVersionRepository', 'FlowExecutionRepository', 'AgentRepository', 'MessageRepository', 'ConversationEventRepository', 'RealtimeGatewayPort', 'JobQueuePort', 'DeveloperEventsPort', 'AutoAssignConversationUseCase', 'ConversationLabelRepository'],
  },
  {
    provide: 'CancelActiveFlowExecutionUseCase',
    useFactory: (execRepo: any, flowRepo: any, eventRepo: any, gateway: any) =>
      new CancelActiveFlowExecutionUseCase(execRepo, flowRepo, eventRepo, gateway),
    inject: ['FlowExecutionRepository', 'FlowRepository', 'ConversationEventRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'StartFlowFromWebhookUseCase',
    useFactory: (flowRepo: any, versionRepo: any, execRepo: any, contactRepo: any, convRepo: any, phoneRepo: any, eventRepo: any, gateway: any, jobQueue: any) =>
      new StartFlowFromWebhookUseCase(flowRepo, versionRepo, execRepo, contactRepo, convRepo, phoneRepo, eventRepo, gateway, jobQueue),
    inject: ['FlowRepository', 'FlowVersionRepository', 'FlowExecutionRepository', 'ContactRepository', 'ConversationRepository', 'PhoneNumberRepository', 'ConversationEventRepository', 'RealtimeGatewayPort', 'JobQueuePort'],
  },
  {
    provide: 'CreateFlowUseCase',
    useFactory: (flowRepo: any) => new CreateFlowUseCase(flowRepo),
    inject: ['FlowRepository'],
  },
  {
    provide: 'ListFlowsUseCase',
    useFactory: (flowRepo: any) => new ListFlowsUseCase(flowRepo),
    inject: ['FlowRepository'],
  },
  {
    provide: 'GetFlowUseCase',
    useFactory: (flowRepo: any, versionRepo: any) => new GetFlowUseCase(flowRepo, versionRepo),
    inject: ['FlowRepository', 'FlowVersionRepository'],
  },
  {
    provide: 'UpdateFlowUseCase',
    useFactory: (flowRepo: any) => new UpdateFlowUseCase(flowRepo),
    inject: ['FlowRepository'],
  },
  {
    provide: 'CheckFlowUseCase',
    useFactory: (flowRepo: any, templateRepo: any, labelRepo: any, agentRepo: any, phoneRepo: any, connectionRepo: any) =>
      new CheckFlowUseCase(flowRepo, { templateRepo, labelRepo, agentRepo, phoneRepo, connectionRepo }),
    inject: [
      'FlowRepository', 'MessageTemplateRepository', 'LabelRepository', 'AgentRepository',
      'PhoneNumberRepository', 'FlowConnectionRepository',
    ],
  },
  {
    provide: 'PublishFlowUseCase',
    useFactory: (flowRepo: any, versionRepo: any, connectionRepo: any, templateRepo: any, labelRepo: any, agentRepo: any, phoneRepo: any, checkPlanLimit: any) =>
      new PublishFlowUseCase(flowRepo, versionRepo, connectionRepo, templateRepo, labelRepo, agentRepo, phoneRepo, checkPlanLimit),
    inject: ['FlowRepository', 'FlowVersionRepository', 'FlowConnectionRepository', 'MessageTemplateRepository', 'LabelRepository', 'AgentRepository', 'PhoneNumberRepository', 'CheckPlanLimitUseCase'],
  },
  {
    provide: 'EnsureDefaultPhoneFlowUseCase',
    useFactory: (flowRepo: any, agentRepo: any, createFlow: any, publishFlow: any) =>
      new EnsureDefaultPhoneFlowUseCase(flowRepo, agentRepo, createFlow, publishFlow),
    inject: ['FlowRepository', 'AgentRepository', 'CreateFlowUseCase', 'PublishFlowUseCase'],
  },
  {
    provide: 'PauseFlowUseCase',
    useFactory: (flowRepo: any) => new PauseFlowUseCase(flowRepo),
    inject: ['FlowRepository'],
  },
  {
    provide: 'ActivateFlowUseCase',
    useFactory: (flowRepo: any, checkPlanLimit: any) => new ActivateFlowUseCase(flowRepo, checkPlanLimit),
    inject: ['FlowRepository', 'CheckPlanLimitUseCase'],
  },
  {
    provide: 'ArchiveFlowUseCase',
    useFactory: (flowRepo: any, execRepo: any) => new ArchiveFlowUseCase(flowRepo, execRepo),
    inject: ['FlowRepository', 'FlowExecutionRepository'],
  },
  {
    provide: 'RegenerateWebhookTokenUseCase',
    useFactory: (flowRepo: any) => new RegenerateWebhookTokenUseCase(flowRepo),
    inject: ['FlowRepository'],
  },
  {
    provide: 'ListFlowExecutionsUseCase',
    useFactory: (flowRepo: any, execRepo: any, contactRepo: any) => new ListFlowExecutionsUseCase(flowRepo, execRepo, contactRepo),
    inject: ['FlowRepository', 'FlowExecutionRepository', 'ContactRepository'],
  },
  {
    provide: 'GetFlowExecutionUseCase',
    useFactory: (execRepo: any) => new GetFlowExecutionUseCase(execRepo),
    inject: ['FlowExecutionRepository'],
  },
  {
    provide: 'CancelFlowExecutionUseCase',
    useFactory: (execRepo: any, cancelActive: any) => new CancelFlowExecutionUseCase(execRepo, cancelActive),
    inject: ['FlowExecutionRepository', 'CancelActiveFlowExecutionUseCase'],
  },
  {
    provide: 'GetActiveFlowForConversationUseCase',
    useFactory: (execRepo: any, flowRepo: any) => new GetActiveFlowForConversationUseCase(execRepo, flowRepo),
    inject: ['FlowExecutionRepository', 'FlowRepository'],
  },
  {
    provide: 'GetFlowStatsUseCase',
    useFactory: (flowRepo: any, statRepo: any) => new GetFlowStatsUseCase(flowRepo, statRepo),
    inject: ['FlowRepository', 'FlowNodeStatRepository'],
  },
  {
    provide: 'GetFlowVersionsUseCase',
    useFactory: (flowRepo: any, versionRepo: any) => new GetFlowVersionsUseCase(flowRepo, versionRepo),
    inject: ['FlowRepository', 'FlowVersionRepository'],
  },
  {
    provide: 'SetupAssistantUseCase',
    useFactory: (tenantRepo: any, createFlow: any, updateFlow: any, publishFlow: any, aiCompletion: any) =>
      new SetupAssistantUseCase(tenantRepo, createFlow, updateFlow, publishFlow, aiCompletion),
    inject: ['TenantRepository', 'CreateFlowUseCase', 'UpdateFlowUseCase', 'PublishFlowUseCase', 'AiCompletionPort'],
  },
  {
    provide: 'SimulateFlowUseCase',
    useFactory: (
      flowRepo: any, versionRepo: any, connectionRepo: any, phoneRepo: any, agentRepo: any,
      tenantRepo: any, labelRepo: any, templateRepo: any, aiCompletion: any,
      secrets: any, assetRepo: any, mediaAccess: any,
    ) =>
      new SimulateFlowUseCase(
        flowRepo, versionRepo, connectionRepo, phoneRepo, agentRepo,
        tenantRepo, labelRepo, templateRepo, aiCompletion,
        secrets, assetRepo, mediaAccess,
      ),
    inject: [
      'FlowRepository', 'FlowVersionRepository', 'FlowConnectionRepository', 'PhoneNumberRepository', 'AgentRepository',
      'TenantRepository', 'LabelRepository', 'MessageTemplateRepository', 'AiCompletionPort', 'FlowSecretsPort',
      'MediaAssetRepository', 'MediaAccessService',
    ],
  },
  {
    provide: 'GetFlowVersionUseCase',
    useFactory: (flowRepo: any, versionRepo: any) => new GetFlowVersionUseCase(flowRepo, versionRepo),
    inject: ['FlowRepository', 'FlowVersionRepository'],
  },
  {
    provide: 'CreateFlowConnectionUseCase',
    useFactory: (connectionRepo: any, secrets: any) => new CreateFlowConnectionUseCase(connectionRepo, secrets),
    inject: ['FlowConnectionRepository', 'FlowSecretsPort'],
  },
  {
    provide: 'ListFlowConnectionsUseCase',
    useFactory: (connectionRepo: any) => new ListFlowConnectionsUseCase(connectionRepo),
    inject: ['FlowConnectionRepository'],
  },
  {
    provide: 'DeleteFlowConnectionUseCase',
    useFactory: (connectionRepo: any, flowRepo: any, versionRepo: any) => new DeleteFlowConnectionUseCase(connectionRepo, flowRepo, versionRepo),
    inject: ['FlowConnectionRepository', 'FlowRepository', 'FlowVersionRepository'],
  },

  // Webhook
  {
    provide: 'HandleInboundMessageUseCase',
    useFactory: (phoneRepo: any, contactRepo: any, convRepo: any, msgRepo: any, gateway: any, eventRepo: any, agentRepo: any, jobQueue: any, versionRepo: any, messagingApi: any, attributeReply: any, sendPush: any, accessRepo: any, flowRouter: any, devEvents: any, registerMedia: any, mediaEnricher: any, resolveIdentity: any) =>
      new HandleInboundMessageUseCase(phoneRepo, contactRepo, convRepo, msgRepo, gateway, eventRepo, agentRepo, jobQueue, versionRepo, messagingApi, attributeReply, sendPush, accessRepo, flowRouter, devEvents, registerMedia, mediaEnricher, resolveIdentity),
    inject: ['PhoneNumberRepository', 'ContactRepository', 'ConversationRepository', 'MessageRepository', 'RealtimeGatewayPort', 'ConversationEventRepository', 'AgentRepository', 'JobQueuePort', 'FlowVersionRepository', 'MessagingApiPort', 'AttributeCampaignReplyUseCase', 'SendPushToAgentUseCase', 'AgentPhoneAccessRepository', 'FlowInboundRouterUseCase', 'DeveloperEventsPort', 'RegisterInboundMediaUseCase', 'MessageMediaEnricher', 'ResolveContactIdentityUseCase'],
  },
  {
    provide: 'ResolveContactIdentityUseCase',
    useFactory: (contactRepo: any, mergeRepo: any) => new ResolveContactIdentityUseCase(contactRepo, mergeRepo),
    inject: ['ContactRepository', 'ContactMergeRepository'],
  },
  {
    provide: 'HandleUserIdUpdateUseCase',
    useFactory: (phoneRepo: any, contactRepo: any, mergeRepo: any) =>
      new HandleUserIdUpdateUseCase(phoneRepo, contactRepo, mergeRepo),
    inject: ['PhoneNumberRepository', 'ContactRepository', 'ContactMergeRepository'],
  },
  {
    provide: 'HandleAccountEventUseCase',
    useFactory: (phoneRepo: any, gateway: any) => new HandleAccountEventUseCase(phoneRepo, gateway),
    inject: ['PhoneNumberRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'HandleUserPreferenceUseCase',
    useFactory: (contactRepo: any, phoneRepo: any, gateway: any) =>
      new HandleUserPreferenceUseCase(contactRepo, phoneRepo, gateway),
    inject: ['ContactRepository', 'PhoneNumberRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'HandleStatusUpdateUseCase',
    useFactory: (msgRepo: any, gateway: any, campaignRepo: any, recipientRepo: any, convRepo: any, devEvents: any, charges: any) =>
      new HandleStatusUpdateUseCase(msgRepo, gateway, campaignRepo, recipientRepo, convRepo, devEvents, charges),
    inject: ['MessageRepository', 'RealtimeGatewayPort', 'CampaignRepository', 'CampaignRecipientRepository', 'ConversationRepository', 'DeveloperEventsPort', 'MessageChargeRepository'],
  },
  {
    provide: 'HandleTemplateStatusUpdateUseCase',
    useFactory: (templateRepo: any, campaignRepo: any, gateway: any) =>
      new HandleTemplateStatusUpdateUseCase(templateRepo, campaignRepo, gateway),
    inject: ['MessageTemplateRepository', 'CampaignRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'HandleTemplateQualityUpdateUseCase',
    useFactory: (templateRepo: any, gateway: any) => new HandleTemplateQualityUpdateUseCase(templateRepo, gateway),
    inject: ['MessageTemplateRepository', 'RealtimeGatewayPort'],
  },
  {
    provide: 'HandleTemplateCategoryUpdateUseCase',
    useFactory: (templateRepo: any) => new HandleTemplateCategoryUpdateUseCase(templateRepo),
    inject: ['MessageTemplateRepository'],
  },

  // Template
  {
    provide: 'CreateTemplateUseCase',
    useFactory: (templateRepo: any, phoneRepo: any, templateApi: any) =>
      new CreateTemplateUseCase(templateRepo, phoneRepo, templateApi),
    inject: ['MessageTemplateRepository', 'PhoneNumberRepository', 'TemplateManagementPort'],
  },
  {
    provide: 'UpdateTemplateUseCase',
    useFactory: (templateRepo: any, phoneRepo: any, templateApi: any) =>
      new UpdateTemplateUseCase(templateRepo, phoneRepo, templateApi),
    inject: ['MessageTemplateRepository', 'PhoneNumberRepository', 'TemplateManagementPort'],
  },
  {
    provide: 'DeleteTemplateUseCase',
    useFactory: (templateRepo: any, phoneRepo: any, campaignRepo: any, templateApi: any) =>
      new DeleteTemplateUseCase(templateRepo, phoneRepo, campaignRepo, templateApi),
    inject: ['MessageTemplateRepository', 'PhoneNumberRepository', 'CampaignRepository', 'TemplateManagementPort'],
  },
  {
    provide: 'ListTemplatesUseCase',
    useFactory: (templateRepo: any, phoneRepo: any) => new ListTemplatesUseCase(templateRepo, phoneRepo),
    inject: ['MessageTemplateRepository', 'PhoneNumberRepository'],
  },
  {
    provide: 'ListWhatsAppFlowsUseCase',
    useFactory: (phoneRepo: any, catalog: any) => new ListWhatsAppFlowsUseCase(phoneRepo, catalog),
    inject: ['PhoneNumberRepository', 'FlowCatalogPort'],
  },
  {
    provide: 'GetTemplateUseCase',
    useFactory: (templateRepo: any) => new GetTemplateUseCase(templateRepo),
    inject: ['MessageTemplateRepository'],
  },
  {
    provide: 'SyncTemplatesUseCase',
    useFactory: (templateRepo: any, phoneRepo: any, templateApi: any) =>
      new SyncTemplatesUseCase(templateRepo, phoneRepo, templateApi),
    inject: ['MessageTemplateRepository', 'PhoneNumberRepository', 'TemplateManagementPort'],
  },

  // Campaign
  {
    provide: 'CreateCampaignUseCase',
    useFactory: (campaignRepo: any, templateRepo: any, phoneRepo: any) =>
      new CreateCampaignUseCase(campaignRepo, templateRepo, phoneRepo),
    inject: ['CampaignRepository', 'MessageTemplateRepository', 'PhoneNumberRepository'],
  },
  {
    provide: 'UpdateCampaignUseCase',
    useFactory: (campaignRepo: any, templateRepo: any) => new UpdateCampaignUseCase(campaignRepo, templateRepo),
    inject: ['CampaignRepository', 'MessageTemplateRepository'],
  },
  {
    provide: 'StartCampaignUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any, templateRepo: any, contactRepo: any, jobQueue: any) =>
      new StartCampaignUseCase(campaignRepo, recipientRepo, templateRepo, contactRepo, jobQueue),
    inject: ['CampaignRepository', 'CampaignRecipientRepository', 'MessageTemplateRepository', 'ContactRepository', 'JobQueuePort'],
  },
  {
    provide: 'PauseCampaignUseCase',
    useFactory: (campaignRepo: any) => new PauseCampaignUseCase(campaignRepo),
    inject: ['CampaignRepository'],
  },
  {
    provide: 'ResumeCampaignUseCase',
    useFactory: (campaignRepo: any, templateRepo: any, jobQueue: any) =>
      new ResumeCampaignUseCase(campaignRepo, templateRepo, jobQueue),
    inject: ['CampaignRepository', 'MessageTemplateRepository', 'JobQueuePort'],
  },
  {
    provide: 'CancelCampaignUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any) => new CancelCampaignUseCase(campaignRepo, recipientRepo),
    inject: ['CampaignRepository', 'CampaignRecipientRepository'],
  },
  {
    provide: 'DeleteCampaignUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any) => new DeleteCampaignUseCase(campaignRepo, recipientRepo),
    inject: ['CampaignRepository', 'CampaignRecipientRepository'],
  },
  {
    provide: 'ListCampaignsUseCase',
    useFactory: (campaignRepo: any) => new ListCampaignsUseCase(campaignRepo),
    inject: ['CampaignRepository'],
  },
  {
    provide: 'GetCampaignUseCase',
    useFactory: (campaignRepo: any) => new GetCampaignUseCase(campaignRepo),
    inject: ['CampaignRepository'],
  },
  {
    provide: 'ListCampaignRecipientsUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any) => new ListCampaignRecipientsUseCase(campaignRepo, recipientRepo),
    inject: ['CampaignRepository', 'CampaignRecipientRepository'],
  },
  {
    provide: 'GetCampaignStatsUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any) => new GetCampaignStatsUseCase(campaignRepo, recipientRepo),
    inject: ['CampaignRepository', 'CampaignRecipientRepository'],
  },
  {
    provide: 'ProcessCampaignBatchUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any, templateRepo: any, phoneRepo: any, convRepo: any, msgRepo: any, messagingApi: any, jobQueue: any, gateway: any, charges: any) =>
      new ProcessCampaignBatchUseCase(campaignRepo, recipientRepo, templateRepo, phoneRepo, convRepo, msgRepo, messagingApi, jobQueue, gateway, charges),
    inject: ['CampaignRepository', 'CampaignRecipientRepository', 'MessageTemplateRepository', 'PhoneNumberRepository', 'ConversationRepository', 'MessageRepository', 'MessagingApiPort', 'JobQueuePort', 'RealtimeGatewayPort', 'MessageChargeRepository'],
  },
  {
    provide: 'AttributeCampaignReplyUseCase',
    useFactory: (campaignRepo: any, recipientRepo: any, gateway: any) =>
      new AttributeCampaignReplyUseCase(campaignRepo, recipientRepo, gateway),
    inject: ['CampaignRepository', 'CampaignRecipientRepository', 'RealtimeGatewayPort'],
  },

  // AI Agent
  {
    provide: 'HandoffToHumanUseCase',
    useFactory: (convRepo: any, noteRepo: any, eventRepo: any, gateway: any, autoAssign: any) =>
      new HandoffToHumanUseCase(convRepo, noteRepo, eventRepo, gateway, autoAssign),
    inject: ['ConversationRepository', 'ConversationNoteRepository', 'ConversationEventRepository', 'RealtimeGatewayPort', 'AutoAssignConversationUseCase'],
  },
  {
    provide: 'ProcessAiResponseUseCase',
    useFactory: (convRepo: any, msgRepo: any, contactRepo: any, phoneRepo: any, tenantRepo: any, versionRepo: any, usageRepo: any, aiCompletion: any, messagingApi: any, gateway: any, handoff: any, labelRepo: any, convLabelRepo: any, eventRepo: any, flowExecRepo: any, devEvents: any) =>
      new ProcessAiResponseUseCase(convRepo, msgRepo, contactRepo, phoneRepo, tenantRepo, versionRepo, usageRepo, aiCompletion, messagingApi, gateway, handoff, labelRepo, convLabelRepo, eventRepo, flowExecRepo, devEvents),
    inject: ['ConversationRepository', 'MessageRepository', 'ContactRepository', 'PhoneNumberRepository', 'TenantRepository', 'FlowVersionRepository', 'AiUsageRepository', 'AiCompletionPort', 'MessagingApiPort', 'RealtimeGatewayPort', 'HandoffToHumanUseCase', 'LabelRepository', 'ConversationLabelRepository', 'ConversationEventRepository', 'FlowExecutionRepository', 'DeveloperEventsPort'],
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

  // Billing
  {
    provide: 'EnforcePlanLimitsUseCase',
    useFactory: (subRepo: any, phoneRepo: any, agentRepo: any) =>
      new EnforcePlanLimitsUseCase(subRepo, phoneRepo, agentRepo),
    inject: ['SubscriptionRepository', 'PhoneNumberRepository', 'AgentRepository'],
  },
  {
    provide: 'ToggleResourceUseCase',
    useFactory: (subRepo: any, phoneRepo: any, agentRepo: any) =>
      new ToggleResourceUseCase(subRepo, phoneRepo, agentRepo),
    inject: ['SubscriptionRepository', 'PhoneNumberRepository', 'AgentRepository'],
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
    useFactory: (subRepo: any, phoneRepo: any, agentRepo: any, convRepo: any, flowRepo: any) =>
      new CheckPlanLimitUseCase(subRepo, phoneRepo, agentRepo, convRepo, flowRepo),
    inject: ['SubscriptionRepository', 'PhoneNumberRepository', 'AgentRepository', 'ConversationRepository', 'FlowRepository'],
  },
  {
    provide: 'CreateCheckoutUseCase',
    useFactory: (subRepo: any, agentRepo: any, paymentProvider: any, providerResolver: any) =>
      new CreateCheckoutUseCase(subRepo, agentRepo, paymentProvider, providerResolver),
    inject: ['SubscriptionRepository', 'AgentRepository', 'PaymentProviderPort', 'PaymentProviderResolverPort'],
  },

  // Contabilidad de mensajes. No es facturación nuestra: los mensajes los cobra
  // Meta directo al cliente y acá sólo se traducen a plata para que los vea.
  {
    provide: 'GetMessageUsageUseCase',
    useFactory: (charges: any, cards: any, templates: any, campaigns: any, phones: any) =>
      new GetMessageUsageUseCase(charges, cards, templates, campaigns, phones),
    inject: ['MessageChargeRepository', 'RateCardRepository', 'MessageTemplateRepository', 'CampaignRepository', 'PhoneNumberRepository'],
  },
  {
    provide: 'RateChargesUseCase',
    useFactory: (charges: any, cards: any) => new RateChargesUseCase(charges, cards),
    inject: ['MessageChargeRepository', 'RateCardRepository'],
  },
  {
    provide: 'ReconcileMetaUsageUseCase',
    useFactory: (charges: any, phones: any, analytics: any) =>
      new ReconcileMetaUsageUseCase(charges, phones, analytics),
    inject: ['MessageChargeRepository', 'PhoneNumberRepository', 'WhatsAppAnalyticsPort'],
  },
  {
    provide: 'HandlePaymentWebhookUseCase',
    useFactory: (subRepo: any, billingRepo: any, enforce: any, jobQueue: any) =>
      new HandlePaymentWebhookUseCase(subRepo, billingRepo, enforce, jobQueue),
    inject: ['SubscriptionRepository', 'BillingRecordRepository', 'EnforcePlanLimitsUseCase', 'JobQueuePort'],
  },

  // Developer platform
  {
    provide: 'GetDeveloperOverviewUseCase',
    useFactory: (subRepo: any, apiKeyRepo: any, endpointRepo: any) =>
      new GetDeveloperOverviewUseCase(subRepo, apiKeyRepo, endpointRepo),
    inject: ['SubscriptionRepository', 'ApiKeyRepository', 'WebhookEndpointRepository'],
  },
  {
    provide: 'CreateApiKeyUseCase',
    useFactory: (apiKeyRepo: any, subRepo: any) => new CreateApiKeyUseCase(apiKeyRepo, subRepo),
    inject: ['ApiKeyRepository', 'SubscriptionRepository'],
  },
  {
    provide: 'ListApiKeysUseCase',
    useFactory: (apiKeyRepo: any) => new ListApiKeysUseCase(apiKeyRepo),
    inject: ['ApiKeyRepository'],
  },
  {
    provide: 'RevokeApiKeyUseCase',
    useFactory: (apiKeyRepo: any) => new RevokeApiKeyUseCase(apiKeyRepo),
    inject: ['ApiKeyRepository'],
  },
  {
    provide: 'AuthenticateApiKeyUseCase',
    useFactory: (apiKeyRepo: any, subRepo: any) => new AuthenticateApiKeyUseCase(apiKeyRepo, subRepo),
    inject: ['ApiKeyRepository', 'SubscriptionRepository'],
  },
  {
    provide: 'CreateWebhookEndpointUseCase',
    useFactory: (endpointRepo: any, subRepo: any) => new CreateWebhookEndpointUseCase(endpointRepo, subRepo),
    inject: ['WebhookEndpointRepository', 'SubscriptionRepository'],
  },
  {
    provide: 'UpdateWebhookEndpointUseCase',
    useFactory: (endpointRepo: any) => new UpdateWebhookEndpointUseCase(endpointRepo),
    inject: ['WebhookEndpointRepository'],
  },
  {
    provide: 'DeleteWebhookEndpointUseCase',
    useFactory: (endpointRepo: any, deliveryRepo: any) => new DeleteWebhookEndpointUseCase(endpointRepo, deliveryRepo),
    inject: ['WebhookEndpointRepository', 'WebhookDeliveryRepository'],
  },
  {
    provide: 'ListWebhookEndpointsUseCase',
    useFactory: (endpointRepo: any) => new ListWebhookEndpointsUseCase(endpointRepo),
    inject: ['WebhookEndpointRepository'],
  },
  {
    provide: 'RotateWebhookSecretUseCase',
    useFactory: (endpointRepo: any) => new RotateWebhookSecretUseCase(endpointRepo),
    inject: ['WebhookEndpointRepository'],
  },
  {
    provide: 'ListWebhookDeliveriesUseCase',
    useFactory: (endpointRepo: any, deliveryRepo: any) => new ListWebhookDeliveriesUseCase(endpointRepo, deliveryRepo),
    inject: ['WebhookEndpointRepository', 'WebhookDeliveryRepository'],
  },
  {
    provide: 'RetryWebhookDeliveryUseCase',
    useFactory: (deliveryRepo: any, jobQueue: any) => new RetryWebhookDeliveryUseCase(deliveryRepo, jobQueue),
    inject: ['WebhookDeliveryRepository', 'JobQueuePort'],
  },
  {
    provide: 'SendTestWebhookUseCase',
    useFactory: (endpointRepo: any, deliveryRepo: any, jobQueue: any) =>
      new SendTestWebhookUseCase(endpointRepo, deliveryRepo, jobQueue),
    inject: ['WebhookEndpointRepository', 'WebhookDeliveryRepository', 'JobQueuePort'],
  },
  {
    provide: 'DeliverWebhookUseCase',
    useFactory: (deliveryRepo: any, endpointRepo: any, http: any, jobQueue: any) =>
      new DeliverWebhookUseCase(deliveryRepo, endpointRepo, http, jobQueue),
    inject: ['WebhookDeliveryRepository', 'WebhookEndpointRepository', 'FlowHttpPort', 'JobQueuePort'],
  },
  {
    provide: 'SendApiMessageUseCase',
    useFactory: (phoneRepo: any, contactRepo: any, convRepo: any, msgRepo: any, templateRepo: any, eventRepo: any, messagingApi: any, gateway: any, devEvents: any, cancelFlow: any, agentRepo: any) =>
      new SendApiMessageUseCase(phoneRepo, contactRepo, convRepo, msgRepo, templateRepo, eventRepo, messagingApi, gateway, devEvents, cancelFlow, agentRepo),
    inject: ['PhoneNumberRepository', 'ContactRepository', 'ConversationRepository', 'MessageRepository', 'MessageTemplateRepository', 'ConversationEventRepository', 'MessagingApiPort', 'RealtimeGatewayPort', 'DeveloperEventsPort', 'CancelActiveFlowExecutionUseCase', 'AgentRepository'],
  },

  // Notifications (web push)
  {
    provide: 'SubscribePushUseCase',
    useFactory: (pushRepo: any) => new SubscribePushUseCase(pushRepo),
    inject: ['PushSubscriptionRepository'],
  },
  {
    provide: 'UnsubscribePushUseCase',
    useFactory: (pushRepo: any) => new UnsubscribePushUseCase(pushRepo),
    inject: ['PushSubscriptionRepository'],
  },
  {
    provide: 'SendPushToAgentUseCase',
    useFactory: (pushRepo: any, webPush: any) => new SendPushToAgentUseCase(pushRepo, webPush),
    inject: ['PushSubscriptionRepository', 'WebPushPort'],
  },

  // Media library
  {
    provide: 'MediaAccessService',
    useFactory: (assetRepo: any, refRepo: any, phoneRepo: any, subRepo: any, storage: any, signer: any, mediaProvider: any, config: ConfigService) =>
      new MediaAccessService(assetRepo, refRepo, phoneRepo, subRepo, storage, signer, mediaProvider, config.get<number>('media.urlTtlSeconds', 900)),
    inject: ['MediaAssetRepository', 'MediaProviderRefRepository', 'PhoneNumberRepository', 'SubscriptionRepository', 'StoragePort', 'MediaUrlSignerPort', 'MediaProviderPort', ConfigService],
  },
  {
    provide: 'MediaStorageService',
    useFactory: (storage: any, images: any, assetRepo: any) => new MediaStorageService(storage, images, assetRepo),
    inject: ['StoragePort', 'ImageProcessorPort', 'MediaAssetRepository'],
  },
  {
    provide: 'MessageMediaEnricher',
    useFactory: (assetRepo: any, mediaAccess: any) => new MessageMediaEnricher(assetRepo, mediaAccess),
    inject: ['MediaAssetRepository', 'MediaAccessService'],
  },
  {
    provide: 'RegisterInboundMediaUseCase',
    useFactory: (assetRepo: any, msgRepo: any, mediaAccess: any, jobQueue: any) =>
      new RegisterInboundMediaUseCase(assetRepo, msgRepo, mediaAccess, jobQueue),
    inject: ['MediaAssetRepository', 'MessageRepository', 'MediaAccessService', 'JobQueuePort'],
  },
  {
    provide: 'IngestMediaAssetUseCase',
    useFactory: (assetRepo: any, mediaAccess: any, mediaStorage: any, gateway: any) =>
      new IngestMediaAssetUseCase(assetRepo, mediaAccess, mediaStorage, gateway),
    inject: ['MediaAssetRepository', 'MediaAccessService', 'MediaStorageService', 'RealtimeGatewayPort'],
  },
  {
    provide: 'UploadMediaUseCase',
    useFactory: (assetRepo: any, refRepo: any, phoneRepo: any, mediaAccess: any, mediaStorage: any, mediaProvider: any, images: any) =>
      new UploadMediaUseCase(assetRepo, refRepo, phoneRepo, mediaAccess, mediaStorage, mediaProvider, images),
    inject: ['MediaAssetRepository', 'MediaProviderRefRepository', 'PhoneNumberRepository', 'MediaAccessService', 'MediaStorageService', 'MediaProviderPort', 'ImageProcessorPort'],
  },
  {
    provide: 'ListMediaUseCase',
    useFactory: (assetRepo: any, accessRepo: any, mediaAccess: any) =>
      new ListMediaUseCase(assetRepo, accessRepo, mediaAccess),
    inject: ['MediaAssetRepository', 'AgentPhoneAccessRepository', 'MediaAccessService'],
  },
  {
    provide: 'GetMediaUsageUseCase',
    useFactory: (assetRepo: any, mediaAccess: any) => new GetMediaUsageUseCase(assetRepo, mediaAccess),
    inject: ['MediaAssetRepository', 'MediaAccessService'],
  },
  {
    provide: 'UpdateMediaUseCase',
    useFactory: (assetRepo: any, mediaAccess: any) => new UpdateMediaUseCase(assetRepo, mediaAccess),
    inject: ['MediaAssetRepository', 'MediaAccessService'],
  },
  {
    provide: 'DeleteMediaUseCase',
    useFactory: (assetRepo: any, refRepo: any) => new DeleteMediaUseCase(assetRepo, refRepo),
    inject: ['MediaAssetRepository', 'MediaProviderRefRepository'],
  },
  {
    provide: 'BackfillTenantMediaUseCase',
    useFactory: (assetRepo: any, mediaAccess: any, jobQueue: any, gateway: any) =>
      new BackfillTenantMediaUseCase(assetRepo, mediaAccess, jobQueue, gateway),
    inject: ['MediaAssetRepository', 'MediaAccessService', 'JobQueuePort', 'RealtimeGatewayPort'],
  },
  {
    provide: 'MediaMaintenanceUseCase',
    useFactory: (assetRepo: any, refRepo: any, mediaStorage: any) =>
      new MediaMaintenanceUseCase(assetRepo, refRepo, mediaStorage),
    inject: ['MediaAssetRepository', 'MediaProviderRefRepository', 'MediaStorageService'],
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
    AccountProfileController,
    WebhookController,
    ContactController,
    TemplateController,
    CampaignController,
    AnalyticsController,
    LabelController,
    BillingController,
    PaymentWebhookController,
    NotificationController,
    FlowController,
    FlowExecutionController,
    FlowConnectionController,
    FlowWebhookController,
    DeveloperController,
    PublicApiController,
    PublicFlowsController,
    McpController,
    MediaController,
  ],
  providers: [
    AsisMcpServerFactory,
    ...useCaseProviders,
    WebhookJobProcessor,
    AiResponseJobProcessor,
    EmailJobProcessor,
    CampaignJobProcessor,
    FlowJobProcessor,
    DeveloperWebhookJobProcessor,
    MediaJobProcessor,
    BillingJobProcessor,
    PlanLimitGuard,
    ApiKeyGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DemoGuard },
  ],
})
export class PresentationModule {}
