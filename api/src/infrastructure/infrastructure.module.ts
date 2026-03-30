import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module.js';
import { AuthInfraModule } from './auth/auth-infra.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { WebSocketInfraModule } from './websocket/websocket.module.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [PersistenceModule, AuthInfraModule, MessagingModule, WebSocketInfraModule, QueueModule],
  exports: [PersistenceModule, AuthInfraModule, MessagingModule, WebSocketInfraModule, QueueModule],
})
export class InfrastructureModule {}
