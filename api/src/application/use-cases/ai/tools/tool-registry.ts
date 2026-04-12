import type { ToolDefinition } from '../../../ports/ai-completion.port.js';

export interface ToolContext {
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  tenantId: string;
  agentId: string;
  agentName: string;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

export class ToolRegistry {
  private readonly tools: RegisteredTool[] = [];

  register(tool: RegisteredTool): void {
    this.tools.push(tool);
  }

  registerAll(tools: RegisteredTool[]): void {
    this.tools.push(...tools);
  }

  getDefinitions(): ToolDefinition[] {
    return this.tools.map((t) => t.definition);
  }

  async execute(toolName: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const tool = this.tools.find((t) => t.definition.name === toolName);
    if (!tool) return `Unknown tool: ${toolName}`;
    return tool.handler(args, ctx);
  }
}
