export interface PluginStateRepository {
  getState<T>(conversationId: string, pluginId: string): Promise<T | null>;
  setState<T>(conversationId: string, pluginId: string, state: T): Promise<void>;
  clearState(conversationId: string, pluginId: string): Promise<void>;
  clearAllForConversation(conversationId: string): Promise<void>;
}
