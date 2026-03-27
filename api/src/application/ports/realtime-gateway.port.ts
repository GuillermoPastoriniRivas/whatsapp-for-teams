export interface RealtimeGatewayPort {
  emitToAgent(agentId: string, event: string, payload: unknown): void;
  emitToTenant(tenantId: string, event: string, payload: unknown): void;
  emitToConversation(conversationId: string, event: string, payload: unknown): void;
}
