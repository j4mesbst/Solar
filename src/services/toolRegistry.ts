export type ToolPermissions =
  "project.read" | "project.write" | "network.search" | "execution.isolated";
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  permissions: ToolPermissions[];
  execute: (input: unknown, signal: AbortSignal) => Promise<unknown>;
}
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) throw new Error("Outil déjà enregistré");
    this.tools.set(tool.name, tool);
  }
  get(name: string) {
    return this.tools.get(name);
  }
  list() {
    return [...this.tools.values()];
  }
}
export class ToolExecutor {
  private registry: ToolRegistry;
  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }
  async run(
    name: string,
    input: unknown,
    grants: Set<ToolPermissions>,
    signal: AbortSignal,
  ) {
    const tool = this.registry.get(name);
    if (!tool) throw new Error("Outil inconnu");
    if (tool.permissions.some((p) => !grants.has(p)))
      throw new Error("Autorisation manquante");
    signal.throwIfAborted();
    return tool.execute(input, signal);
  }
}
export interface SkillDefinition {
  id: string;
  instructions: string;
  tools: string[];
}
export interface PluginDefinition {
  id: string;
  tools: ToolDefinition[];
  transport?: "internal" | "mcp";
}
export class SkillRegistry {
  entries = new Map<string, SkillDefinition>();
  register(skill: SkillDefinition) {
    this.entries.set(skill.id, skill);
  }
}
export class PluginRegistry {
  entries = new Map<string, PluginDefinition>();
  register(plugin: PluginDefinition) {
    this.entries.set(plugin.id, plugin);
  }
}
export const tools = new ToolRegistry();
