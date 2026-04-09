import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import type {
  CognitivePlugin,
  PluginContext,
  PluginActionResult,
} from '../../../domain/value-objects/plugin.types.js';
import type {
  CognitiveAction,
  ActionExecutionResult,
  IntentResult,
} from '../../../domain/value-objects/cognitive-loop.types.js';
import type { PhoneNumberPlugin } from '../../../domain/enums/phone-number-plugin.enum.js';

export const COGNITIVE_PLUGINS = 'COGNITIVE_PLUGINS';

@Injectable()
export class PluginRegistry {
  private readonly logger = new Logger(PluginRegistry.name);
  private readonly pluginMap = new Map<string, CognitivePlugin>();
  private readonly actionToPlugin = new Map<string, CognitivePlugin>();

  constructor(@Inject(COGNITIVE_PLUGINS) @Optional() plugins: CognitivePlugin[] = []) {
    for (const plugin of plugins) {
      this.pluginMap.set(plugin.pluginId, plugin);
      for (const actionType of plugin.getHandledActionTypes()) {
        this.actionToPlugin.set(actionType, plugin);
      }
      this.logger.log(`Registered plugin: ${plugin.displayName} (${plugin.pluginId}), actions: [${plugin.getHandledActionTypes().join(', ')}]`);
    }
  }

  getActivePlugins(enabledPlugins: PhoneNumberPlugin[]): CognitivePlugin[] {
    return enabledPlugins
      .map((id) => this.pluginMap.get(id))
      .filter((p): p is CognitivePlugin => !!p);
  }

  findPluginForAction(actionType: string, enabledPlugins: PhoneNumberPlugin[]): CognitivePlugin | null {
    const plugin = this.actionToPlugin.get(actionType);
    if (!plugin) return null;
    if (!enabledPlugins.includes(plugin.pluginId)) return null;
    return plugin;
  }

  async buildAllPromptContributions(
    ctx: PluginContext,
    enabledPlugins: PhoneNumberPlugin[],
  ): Promise<{ intentSections: string[]; responseSections: string[] }> {
    const intentSections: string[] = [];
    const responseSections: string[] = [];

    for (const plugin of this.getActivePlugins(enabledPlugins)) {
      const contribution = await plugin.buildPromptContributions(ctx);
      intentSections.push(...contribution.intentPromptSections);
      responseSections.push(...contribution.responsePromptSections);
    }

    return { intentSections, responseSections };
  }

  async runAfterActions(
    ctx: PluginContext,
    enabledPlugins: PhoneNumberPlugin[],
    intentResult: IntentResult,
    actionResults: ActionExecutionResult[],
  ): Promise<string[]> {
    const directives: string[] = [];
    for (const plugin of this.getActivePlugins(enabledPlugins)) {
      const result = await plugin.afterActions(ctx, intentResult, actionResults);
      if (result.responseDirective) {
        directives.push(result.responseDirective);
      }
    }
    return directives;
  }

  async onConversationResolved(conversationId: string): Promise<void> {
    for (const plugin of this.pluginMap.values()) {
      await plugin.onConversationResolved(conversationId);
    }
  }
}
