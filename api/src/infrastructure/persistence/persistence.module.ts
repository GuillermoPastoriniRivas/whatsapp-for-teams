import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantModel, TenantSchema } from './mongoose/schemas/tenant.schema.js';
import { PhoneNumberModel, PhoneNumberSchema } from './mongoose/schemas/phone-number.schema.js';
import { AgentModel, AgentSchema } from './mongoose/schemas/agent.schema.js';
import { AgentPhoneAccessModel, AgentPhoneAccessSchema } from './mongoose/schemas/agent-phone-access.schema.js';
import { ContactModel, ContactSchema } from './mongoose/schemas/contact.schema.js';
import { ConversationModel, ConversationSchema } from './mongoose/schemas/conversation.schema.js';
import { MessageModel, MessageSchema } from './mongoose/schemas/message.schema.js';
import { RefreshTokenModel, RefreshTokenSchema } from './mongoose/schemas/refresh-token.schema.js';
import { ConversationEventModel, ConversationEventSchema } from './mongoose/schemas/conversation-event.schema.js';
import { ConversationNoteModel, ConversationNoteSchema } from './mongoose/schemas/conversation-note.schema.js';
import { AiUsageModel, AiUsageSchema } from './mongoose/schemas/ai-usage.schema.js';
import { LabelModel, LabelSchema } from './mongoose/schemas/label.schema.js';
import { ConversationLabelModel, ConversationLabelSchema } from './mongoose/schemas/conversation-label.schema.js';
import { MongoTenantRepository } from './mongoose/repositories/mongo-tenant.repository.js';
import { MongoPhoneNumberRepository } from './mongoose/repositories/mongo-phone-number.repository.js';
import { MongoAgentRepository } from './mongoose/repositories/mongo-agent.repository.js';
import { MongoAgentPhoneAccessRepository } from './mongoose/repositories/mongo-agent-phone-access.repository.js';
import { MongoContactRepository } from './mongoose/repositories/mongo-contact.repository.js';
import { MongoContactMergeRepository } from './mongoose/repositories/mongo-contact-merge.repository.js';
import { MongoConversationRepository } from './mongoose/repositories/mongo-conversation.repository.js';
import { MongoMessageRepository } from './mongoose/repositories/mongo-message.repository.js';
import { MongoRefreshTokenRepository } from './mongoose/repositories/mongo-refresh-token.repository.js';
import { MongoConversationEventRepository } from './mongoose/repositories/mongo-conversation-event.repository.js';
import { MongoConversationNoteRepository } from './mongoose/repositories/mongo-conversation-note.repository.js';
import { MongoAiUsageRepository } from './mongoose/repositories/mongo-ai-usage.repository.js';
import { MongoLabelRepository } from './mongoose/repositories/mongo-label.repository.js';
import { MongoConversationLabelRepository } from './mongoose/repositories/mongo-conversation-label.repository.js';
import { SubscriptionModel, SubscriptionSchema } from './mongoose/schemas/subscription.schema.js';
import { BillingRecordModel, BillingRecordSchema } from './mongoose/schemas/billing-record.schema.js';
import { MongoSubscriptionRepository } from './mongoose/repositories/mongo-subscription.repository.js';
import { MongoBillingRecordRepository } from './mongoose/repositories/mongo-billing-record.repository.js';
import { PasswordResetTokenModel, PasswordResetTokenSchema } from './mongoose/schemas/password-reset-token.schema.js';
import { MongoPasswordResetTokenRepository } from './mongoose/repositories/mongo-password-reset-token.repository.js';
import { MessageTemplateModel, MessageTemplateSchema } from './mongoose/schemas/message-template.schema.js';
import { CampaignModel, CampaignSchema } from './mongoose/schemas/campaign.schema.js';
import { CampaignRecipientModel, CampaignRecipientSchema } from './mongoose/schemas/campaign-recipient.schema.js';
import { MongoMessageTemplateRepository } from './mongoose/repositories/mongo-message-template.repository.js';
import { MongoCampaignRepository } from './mongoose/repositories/mongo-campaign.repository.js';
import { MongoCampaignRecipientRepository } from './mongoose/repositories/mongo-campaign-recipient.repository.js';
import { PushSubscriptionModel, PushSubscriptionSchema } from './mongoose/schemas/push-subscription.schema.js';
import { MongoPushSubscriptionRepository } from './mongoose/repositories/mongo-push-subscription.repository.js';
import { FlowModel, FlowSchema } from './mongoose/schemas/flow.schema.js';
import { FlowVersionModel, FlowVersionSchema } from './mongoose/schemas/flow-version.schema.js';
import { FlowExecutionModel, FlowExecutionSchema } from './mongoose/schemas/flow-execution.schema.js';
import { FlowNodeStatModel, FlowNodeStatSchema } from './mongoose/schemas/flow-node-stat.schema.js';
import { FlowConnectionModel, FlowConnectionSchema } from './mongoose/schemas/flow-connection.schema.js';
import { ApiKeyModel, ApiKeySchema } from './mongoose/schemas/api-key.schema.js';
import { WebhookEndpointModel, WebhookEndpointSchema } from './mongoose/schemas/webhook-endpoint.schema.js';
import { WebhookDeliveryModel, WebhookDeliverySchema } from './mongoose/schemas/webhook-delivery.schema.js';
import { MongoApiKeyRepository } from './mongoose/repositories/mongo-api-key.repository.js';
import { MongoWebhookEndpointRepository } from './mongoose/repositories/mongo-webhook-endpoint.repository.js';
import { MongoWebhookDeliveryRepository } from './mongoose/repositories/mongo-webhook-delivery.repository.js';
import { MongoFlowRepository } from './mongoose/repositories/mongo-flow.repository.js';
import { MongoFlowVersionRepository } from './mongoose/repositories/mongo-flow-version.repository.js';
import { MongoFlowExecutionRepository } from './mongoose/repositories/mongo-flow-execution.repository.js';
import { MongoFlowNodeStatRepository } from './mongoose/repositories/mongo-flow-node-stat.repository.js';
import { MongoFlowConnectionRepository } from './mongoose/repositories/mongo-flow-connection.repository.js';
import { MediaAssetModel, MediaAssetSchema } from './mongoose/schemas/media-asset.schema.js';
import { MediaProviderRefModel, MediaProviderRefSchema } from './mongoose/schemas/media-provider-ref.schema.js';
import { ServiceProviderModel, ServiceProviderSchema } from './mongoose/schemas/service-provider.schema.js';
import { MongoMediaAssetRepository } from './mongoose/repositories/mongo-media-asset.repository.js';
import { MongoMediaProviderRefRepository } from './mongoose/repositories/mongo-media-provider-ref.repository.js';
import { MongoServiceProviderRepository } from './mongoose/repositories/mongo-service-provider.repository.js';

const schemas = MongooseModule.forFeature([
  { name: TenantModel.name, schema: TenantSchema },
  { name: PhoneNumberModel.name, schema: PhoneNumberSchema },
  { name: AgentModel.name, schema: AgentSchema },
  { name: AgentPhoneAccessModel.name, schema: AgentPhoneAccessSchema },
  { name: ContactModel.name, schema: ContactSchema },
  { name: ConversationModel.name, schema: ConversationSchema },
  { name: MessageModel.name, schema: MessageSchema },
  { name: RefreshTokenModel.name, schema: RefreshTokenSchema },
  { name: ConversationEventModel.name, schema: ConversationEventSchema },
  { name: ConversationNoteModel.name, schema: ConversationNoteSchema },
  { name: AiUsageModel.name, schema: AiUsageSchema },
  { name: LabelModel.name, schema: LabelSchema },
  { name: ConversationLabelModel.name, schema: ConversationLabelSchema },
  { name: SubscriptionModel.name, schema: SubscriptionSchema },
  { name: BillingRecordModel.name, schema: BillingRecordSchema },
  { name: PasswordResetTokenModel.name, schema: PasswordResetTokenSchema },
  { name: MessageTemplateModel.name, schema: MessageTemplateSchema },
  { name: CampaignModel.name, schema: CampaignSchema },
  { name: CampaignRecipientModel.name, schema: CampaignRecipientSchema },
  { name: PushSubscriptionModel.name, schema: PushSubscriptionSchema },
  { name: FlowModel.name, schema: FlowSchema },
  { name: FlowVersionModel.name, schema: FlowVersionSchema },
  { name: FlowExecutionModel.name, schema: FlowExecutionSchema },
  { name: FlowNodeStatModel.name, schema: FlowNodeStatSchema },
  { name: FlowConnectionModel.name, schema: FlowConnectionSchema },
  { name: ApiKeyModel.name, schema: ApiKeySchema },
  { name: WebhookEndpointModel.name, schema: WebhookEndpointSchema },
  { name: WebhookDeliveryModel.name, schema: WebhookDeliverySchema },
  { name: MediaAssetModel.name, schema: MediaAssetSchema },
  { name: MediaProviderRefModel.name, schema: MediaProviderRefSchema },
  { name: ServiceProviderModel.name, schema: ServiceProviderSchema },
]);

const repositories = [
  { provide: 'TenantRepository', useClass: MongoTenantRepository },
  { provide: 'PhoneNumberRepository', useClass: MongoPhoneNumberRepository },
  { provide: 'AgentRepository', useClass: MongoAgentRepository },
  { provide: 'AgentPhoneAccessRepository', useClass: MongoAgentPhoneAccessRepository },
  { provide: 'ContactRepository', useClass: MongoContactRepository },
  { provide: 'ContactMergeRepository', useClass: MongoContactMergeRepository },
  { provide: 'ConversationRepository', useClass: MongoConversationRepository },
  { provide: 'MessageRepository', useClass: MongoMessageRepository },
  { provide: 'RefreshTokenRepository', useClass: MongoRefreshTokenRepository },
  { provide: 'ConversationEventRepository', useClass: MongoConversationEventRepository },
  { provide: 'ConversationNoteRepository', useClass: MongoConversationNoteRepository },
  { provide: 'AiUsageRepository', useClass: MongoAiUsageRepository },
  { provide: 'LabelRepository', useClass: MongoLabelRepository },
  { provide: 'ConversationLabelRepository', useClass: MongoConversationLabelRepository },
  { provide: 'SubscriptionRepository', useClass: MongoSubscriptionRepository },
  { provide: 'BillingRecordRepository', useClass: MongoBillingRecordRepository },
  { provide: 'PasswordResetTokenRepository', useClass: MongoPasswordResetTokenRepository },
  { provide: 'MessageTemplateRepository', useClass: MongoMessageTemplateRepository },
  { provide: 'CampaignRepository', useClass: MongoCampaignRepository },
  { provide: 'CampaignRecipientRepository', useClass: MongoCampaignRecipientRepository },
  { provide: 'PushSubscriptionRepository', useClass: MongoPushSubscriptionRepository },
  { provide: 'FlowRepository', useClass: MongoFlowRepository },
  { provide: 'FlowVersionRepository', useClass: MongoFlowVersionRepository },
  { provide: 'FlowExecutionRepository', useClass: MongoFlowExecutionRepository },
  { provide: 'FlowNodeStatRepository', useClass: MongoFlowNodeStatRepository },
  { provide: 'FlowConnectionRepository', useClass: MongoFlowConnectionRepository },
  { provide: 'ApiKeyRepository', useClass: MongoApiKeyRepository },
  { provide: 'WebhookEndpointRepository', useClass: MongoWebhookEndpointRepository },
  { provide: 'WebhookDeliveryRepository', useClass: MongoWebhookDeliveryRepository },
  { provide: 'MediaAssetRepository', useClass: MongoMediaAssetRepository },
  { provide: 'MediaProviderRefRepository', useClass: MongoMediaProviderRefRepository },
  { provide: 'ServiceProviderRepository', useClass: MongoServiceProviderRepository },
];

@Module({
  imports: [schemas],
  providers: [...repositories],
  exports: [...repositories],
})
export class PersistenceModule {}
