import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module.js';
import { AuthInfraModule } from './auth/auth-infra.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { WebSocketInfraModule } from './websocket/websocket.module.js';

@Module({
  imports: [PersistenceModule, AuthInfraModule, MessagingModule, WebSocketInfraModule],
  exports: [PersistenceModule, AuthInfraModule, MessagingModule, WebSocketInfraModule],
})
export class InfrastructureModule {}
