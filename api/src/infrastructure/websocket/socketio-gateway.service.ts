import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeGatewayPort } from '../../application/ports/realtime-gateway.port.js';

@Injectable()
@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class SocketIoGatewayService
  implements RealtimeGatewayPort, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token;
    if (!token) {
      client.disconnect();
      return;
    }

    // TODO: verify JWT and extract agentId + tenantId
    // For now, read from handshake query as fallback
    const agentId = client.handshake.query?.agentId as string;
    const tenantId = client.handshake.query?.tenantId as string;

    if (agentId) client.join(`agent:${agentId}`);
    if (tenantId) client.join(`tenant:${tenantId}`);

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
