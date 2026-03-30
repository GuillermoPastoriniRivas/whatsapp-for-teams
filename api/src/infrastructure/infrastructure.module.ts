import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module.js';
import { AuthInfraModule } from './auth/auth-infra.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { WebSocketInfraModule } from './websocket/websocket.module.js';
import { QueueModule } from './queue/queue.module.js';
import { AiModule } from './ai/ai.module.js';

@Module({
  imports: [PersistenceModule, AuthInfraModule, MessagingModule, WebSocketInfraModule, QueueModule, AiModule],
  exports: [PersistenceModule, AuthInfraModule, MessagingModule, WebSocketInfraModule, QueueModule, AiModule],
})
export class InfrastructureModule {}
