import { Module } from '@nestjs/common';
import { SocketIoGatewayService } from './socketio-gateway.service.js';

@Module({
  providers: [
    SocketIoGatewayService,
    { provide: 'RealtimeGatewayPort', useExisting: SocketIoGatewayService },
  ],
  exports: ['RealtimeGatewayPort'],
})
export class WebSocketInfraModule {}
