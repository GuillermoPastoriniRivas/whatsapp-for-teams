import { Module } from '@nestjs/common';
import { AuthInfraModule } from '../auth/auth-infra.module.js';
import { SocketIoGatewayService } from './socketio-gateway.service.js';

@Module({
  imports: [AuthInfraModule],
  providers: [
    SocketIoGatewayService,
    { provide: 'RealtimeGatewayPort', useExisting: SocketIoGatewayService },
  ],
  exports: ['RealtimeGatewayPort'],
})
export class WebSocketInfraModule {}
