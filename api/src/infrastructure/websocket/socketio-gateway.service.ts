import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeGatewayPort } from '../../application/ports/realtime-gateway.port.js';
import type { TokenProviderPort } from '../../application/ports/token-provider.port.js';

@Injectable()
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
})
export class SocketIoGatewayService
  implements RealtimeGatewayPort, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketIoGatewayService.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    @Inject('TokenProviderPort') private readonly tokenProvider: TokenProviderPort,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token;
    if (!token) {
      client.emit('auth_error', { message: 'no token' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.tokenProvider.verifyAccess(token);
      client.join(`agent:${payload.sub}`);
      client.join(`tenant:${payload.tenantId}`);
      this.logger.log(`Agent ${payload.sub} connected (tenant: ${payload.tenantId})`);
    } catch {
      this.logger.warn('Socket connection rejected: invalid token');
      client.emit('auth_error', { message: 'invalid token' });
      client.disconnect();
      return;
    }

    client.on('join:conversation', (data: { conversationId: string }) => {
      client.join(`conv:${data.conversationId}`);
    });

    client.on('leave:conversation', (data: { conversationId: string }) => {
      client.leave(`conv:${data.conversationId}`);
    });
  }

  handleDisconnect(_client: Socket): void {
    // Rooms are cleaned up automatically by Socket.io
  }

  emitToAgent(agentId: string, event: string, payload: unknown): void {
    this.server.to(`agent:${agentId}`).emit(event, payload);
  }

  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  emitToConversation(conversationId: string, event: string, payload: unknown): void {
    this.server.to(`conv:${conversationId}`).emit(event, payload);
  }
}
