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
import { AiAgentConfigModel, AiAgentConfigSchema } from './mongoose/schemas/ai-agent-config.schema.js';
import { AiUsageModel, AiUsageSchema } from './mongoose/schemas/ai-usage.schema.js';
import { LabelModel, LabelSchema } from './mongoose/schemas/label.schema.js';
import { ConversationLabelModel, ConversationLabelSchema } from './mongoose/schemas/conversation-label.schema.js';
import { MongoTenantRepository } from './mongoose/repositories/mongo-tenant.repository.js';
import { MongoPhoneNumberRepository } from './mongoose/repositories/mongo-phone-number.repository.js';
import { MongoAgentRepository } from './mongoose/repositories/mongo-agent.repository.js';
import { MongoAgentPhoneAccessRepository } from './mongoose/repositories/mongo-agent-phone-access.repository.js';
import { MongoContactRepository } from './mongoose/repositories/mongo-contact.repository.js';
import { MongoConversationRepository } from './mongoose/repositories/mongo-conversation.repository.js';
import { MongoMessageRepository } from './mongoose/repositories/mongo-message.repository.js';
import { MongoRefreshTokenRepository } from './mongoose/repositories/mongo-refresh-token.repository.js';
import { MongoConversationEventRepository } from './mongoose/repositories/mongo-conversation-event.repository.js';
import { MongoConversationNoteRepository } from './mongoose/repositories/mongo-conversation-note.repository.js';
import { MongoAiAgentConfigRepository } from './mongoose/repositories/mongo-ai-agent-config.repository.js';
import { MongoAiUsageRepository } from './mongoose/repositories/mongo-ai-usage.repository.js';
import { MongoLabelRepository } from './mongoose/repositories/mongo-label.repository.js';
import { MongoConversationLabelRepository } from './mongoose/repositories/mongo-conversation-label.repository.js';
import { SubscriptionModel, SubscriptionSchema } from './mongoose/schemas/subscription.schema.js';
import { BillingRecordModel, BillingRecordSchema } from './mongoose/schemas/billing-record.schema.js';
import { MongoSubscriptionRepository } from './mongoose/repositories/mongo-subscription.repository.js';
import { MongoBillingRecordRepository } from './mongoose/repositories/mongo-billing-record.repository.js';
import { PasswordResetTokenModel, PasswordResetTokenSchema } from './mongoose/schemas/password-reset-token.schema.js';
import { OrderModel, OrderSchema } from './mongoose/schemas/order.schema.js';
import { MongoPasswordResetTokenRepository } from './mongoose/repositories/mongo-password-reset-token.repository.js';
import { MongoOrderRepository } from './mongoose/repositories/mongo-order.repository.js';
import { PluginStateModel, PluginStateSchema } from './mongoose/schemas/plugin-state.schema.js';
import { MongoPluginStateRepository } from './mongoose/repositories/mongo-plugin-state.repository.js';
import { EncryptionService } from '../ai/encryption.service.js';

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
  { name: AiAgentConfigModel.name, schema: AiAgentConfigSchema },
  { name: AiUsageModel.name, schema: AiUsageSchema },
  { name: LabelModel.name, schema: LabelSchema },
  { name: ConversationLabelModel.name, schema: ConversationLabelSchema },
  { name: SubscriptionModel.name, schema: SubscriptionSchema },
  { name: BillingRecordModel.name, schema: BillingRecordSchema },
  { name: PasswordResetTokenModel.name, schema: PasswordResetTokenSchema },
  { name: OrderModel.name, schema: OrderSchema },
  { name: PluginStateModel.name, schema: PluginStateSchema },
]);

const repositories = [
  { provide: 'TenantRepository', useClass: MongoTenantRepository },
  { provide: 'PhoneNumberRepository', useClass: MongoPhoneNumberRepository },
  { provide: 'AgentRepository', useClass: MongoAgentRepository },
  { provide: 'AgentPhoneAccessRepository', useClass: MongoAgentPhoneAccessRepository },
  { provide: 'ContactRepository', useClass: MongoContactRepository },
  { provide: 'ConversationRepository', useClass: MongoConversationRepository },
  { provide: 'MessageRepository', useClass: MongoMessageRepository },
  { provide: 'RefreshTokenRepository', useClass: MongoRefreshTokenRepository },
  { provide: 'ConversationEventRepository', useClass: MongoConversationEventRepository },
  { provide: 'ConversationNoteRepository', useClass: MongoConversationNoteRepository },
  { provide: 'AiAgentConfigRepository', useClass: MongoAiAgentConfigRepository },
  { provide: 'AiUsageRepository', useClass: MongoAiUsageRepository },
  { provide: 'LabelRepository', useClass: MongoLabelRepository },
  { provide: 'ConversationLabelRepository', useClass: MongoConversationLabelRepository },
  { provide: 'SubscriptionRepository', useClass: MongoSubscriptionRepository },
  { provide: 'BillingRecordRepository', useClass: MongoBillingRecordRepository },
  { provide: 'PasswordResetTokenRepository', useClass: MongoPasswordResetTokenRepository },
  { provide: 'OrderRepository', useClass: MongoOrderRepository },
  { provide: 'PluginStateRepository', useClass: MongoPluginStateRepository },
];

@Module({
  imports: [schemas],
  providers: [...repositories, EncryptionService],
  exports: [...repositories, EncryptionService],
})
export class PersistenceModule {}
