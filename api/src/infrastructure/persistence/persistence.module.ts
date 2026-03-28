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
];

@Module({
  imports: [schemas],
  providers: [...repositories],
  exports: [...repositories],
})
export class PersistenceModule {}
