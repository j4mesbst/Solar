import { listPluginItems, readPluginItem, readGitHubFile, listGitHubIssues, type PluginId } from "./pluginConnections.ts";
import type { ConnectionGrant } from "./solarAgentStore.ts";
import { validateAgentToolInput } from "./agentToolContract.ts";

export interface AgentTool {
  id: string; description: string; service: PluginId; grant: ConnectionGrant; readOnly: true;
  parameters: { type: "object"; required: string[]; properties: Record<string, { type: "string"; description: string }> };
  execute(input: Record<string, string>, signal: AbortSignal): Promise<{ source: string; content: string }>;
}
const stringField = (description: string) => ({ type: "string" as const, description });
export const agentTools: AgentTool[] = [
  { id: "gmail.search", description: "Recherche des e-mails Gmail et retourne leurs métadonnées", service: "gmail", grant: "gmail.read", readOnly: true,
    parameters: { type: "object", required: ["query"], properties: { query: stringField("Requête de recherche Gmail") } },
    async execute(input, signal) { signal.throwIfAborted(); const items = await listPluginItems("gmail", input.query, signal); signal.throwIfAborted(); return { source: "Gmail", content: JSON.stringify(items) }; } },
  { id: "gmail.read", description: "Lit un e-mail identifié par son identifiant Gmail", service: "gmail", grant: "gmail.read", readOnly: true,
    parameters: { type: "object", required: ["id"], properties: { id: stringField("Identifiant Gmail du message") } },
    async execute(input, signal) { signal.throwIfAborted(); const content = await readPluginItem("gmail", { id: input.id, title: input.id, detail: "Gmail" }, signal); signal.throwIfAborted(); return { source: "Gmail", content }; } },
  { id: "github.repos", description: "Liste les dépôts GitHub accessibles", service: "github", grant: "github.read", readOnly: true,
    parameters: { type: "object", required: [], properties: { query: stringField("Filtre facultatif de nom ; omettre pour tous") } },
    async execute(input, signal) { signal.throwIfAborted(); const items = await listPluginItems("github", input.query ?? "", signal); signal.throwIfAborted(); return { source: "GitHub", content: JSON.stringify(items) }; } },
  { id: "github.readme", description: "Lit le README d'un dépôt GitHub", service: "github", grant: "github.read", readOnly: true,
    parameters: { type: "object", required: ["repository"], properties: { repository: stringField("owner/repository") } },
    async execute(input, signal) { signal.throwIfAborted(); const content = await readPluginItem("github", { id: input.repository, title: input.repository, detail: "README" }, signal); signal.throwIfAborted(); return { source: "GitHub", content }; } },
  { id: "github.file", description: "Lit un fichier d'un dépôt GitHub", service: "github", grant: "github.read", readOnly: true,
    parameters: { type: "object", required: ["repository", "path"], properties: { repository: stringField("owner/repository"), path: stringField("Chemin relatif du fichier") } },
    async execute(input, signal) { signal.throwIfAborted(); const content = await readGitHubFile(input.repository, input.path, signal); signal.throwIfAborted(); return { source: `GitHub ${input.repository}/${input.path}`, content }; } },
  { id: "github.issues", description: "Lit les issues d'un dépôt GitHub", service: "github", grant: "github.read", readOnly: true,
    parameters: { type: "object", required: ["repository"], properties: { repository: stringField("owner/repository") } },
    async execute(input, signal) { signal.throwIfAborted(); const content = JSON.stringify(await listGitHubIssues(input.repository, "issues", signal)); signal.throwIfAborted(); return { source: `GitHub issues ${input.repository}`, content }; } },
  { id: "github.pulls", description: "Lit les pull requests d'un dépôt GitHub", service: "github", grant: "github.read", readOnly: true,
    parameters: { type: "object", required: ["repository"], properties: { repository: stringField("owner/repository") } },
    async execute(input, signal) { signal.throwIfAborted(); const content = JSON.stringify(await listGitHubIssues(input.repository, "pulls", signal)); signal.throwIfAborted(); return { source: `GitHub pull requests ${input.repository}`, content }; } },
];
export function validateToolCall(id: string, input: unknown, grants: ConnectionGrant[]): { tool: AgentTool; args: Record<string, string> } {
  const tool = agentTools.find(item => item.id === id);
  const args = validateAgentToolInput(tool, input, grants);
  return { tool: tool!, args };
}
export async function executeAgentTool(id: string, input: unknown, grants: ConnectionGrant[], signal: AbortSignal) {
  validateToolCall(id, input, grants);
  const { pluginExecution } = await import("./pluginRuntime.ts");
  return pluginExecution(`legacy:${crypto.randomUUID()}`, grants)(id, input, signal);
}
