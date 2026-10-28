export interface ToolContract { id: string; grant: string; parameters: { required: string[]; properties: Record<string, unknown> } }
export function validateAgentToolInput(tool: ToolContract | undefined, input: unknown, grants: string[]): Record<string, string> {
  if (!tool) throw new Error("Outil inconnu.");
  if (!grants.includes(tool.grant)) throw new Error(`Autorisation ${tool.grant} requise pour cet agent.`);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Paramètres d’outil invalides.");
  const args = input as Record<string, unknown>;
  if (Object.keys(args).some(key => !(key in tool.parameters.properties)) || tool.parameters.required.some(key => typeof args[key] !== "string" || !(args[key] as string).trim()) || Object.values(args).some(value => typeof value !== "string" || value.length > 500)) throw new Error("Paramètres d’outil invalides.");
  return args as Record<string, string>;
}
