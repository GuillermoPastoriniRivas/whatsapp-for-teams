import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { WebSocketInfraModule } from '../websocket/websocket.module.js';
import { DemoSimulationService } from './demo-simulation.service.js';

@Module({
  imports: [PersistenceModule, WebSocketInfraModule],
  providers: [DemoSimulationService],
})
export class DemoModule {}
