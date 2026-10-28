import { validateToolParameters } from "./toolSchema.ts";
import type { AgentAccessMode } from "../domain/types.ts";

export type ToolPermissions = "project.read" | "project.write" | "network.search" | "execution.isolated" | `${string}.read` | `${string}.write`;
export type ToolRisk = "read" | "write" | "delete" | "publish" | "execute";
export interface ToolApproval {
  tool: string; plugin: string; account: string; description: string;
  input: unknown; risk: ToolRisk; cloudProvider?: string;
}
export interface ToolExecutionContext {
  durable?:import("../agent/jobs/types").DurableToolGate;
  account: string;
  isCurrentAccount: () => boolean;
  verifyConnection?: (plugin: string, signal: AbortSignal) => Promise<string>;
  approve?: (request: ToolApproval, signal: AbortSignal) => Promise<boolean>;
  cloudProvider?: string;
  accessMode?: AgentAccessMode;
  readOnlyTools?: boolean;
  onEvent?: (event: { tool: string; plugin: string; status: "approved" | "started" | "completed" | "failed" }) => void | Promise<void>;
}
export interface ToolDefinition {
  parallelSafe?:boolean;
  reconcile?:(input:unknown,idempotencyKey:string,signal:AbortSignal)=>Promise<{confirmed:boolean;result:unknown}|undefined>;
  verify?:(input:unknown,result:unknown,signal:AbortSignal)=>Promise<void>;
  outputSchema?:Record<string,unknown>;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  permissions: ToolPermissions[];
  pluginId?: string;
  risk?: ToolRisk;
  externalEffects?: boolean;
  mcpServerId?: string; connectionFingerprint?: string;
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
    context?: ToolExecutionContext,
  ) {
    input=structuredClone(input);
    const tool = this.registry.get(name);
    if (!tool) throw new Error("Outil inconnu");
    signal.throwIfAborted();
    const errors = validateToolParameters(input, tool.parameters);
    if (errors.length) throw new Error(`Paramètres d’outil invalides : ${errors.slice(0, 3).join(" ; ")}`);
    const plugin = tool.pluginId ?? "project";
    const risk = tool.risk ?? (tool.permissions.some(p => /write|execution/.test(p)) ? "write" : "read");
    if ((context?.readOnlyTools || context?.accessMode === "read-only") && (risk !== "read" || tool.externalEffects === true || tool.permissions.some(p=>/\.write$|execution/.test(p)))) throw new Error("Mode Lecture seule : cette action modifie des données. Choisis Accès standard ou Accès complet pour l’autoriser.");
    const assertAccount = () => { if (context && !context.isCurrentAccount()) throw new Error("Le compte Solar a changé. Relance la demande."); signal.throwIfAborted(); };
    assertAccount();
    const identity = context?.verifyConnection ? await context.verifyConnection(plugin, signal) : context?.account ?? "";
    assertAccount();
    // External data going to a cloud model is also reviewed, even for a read.
    const needsApproval = risk !== "read" || tool.externalEffects === true || context?.accessMode !== "full" && (tool.permissions.some(p => !grants.has(p)) || Boolean(context?.cloudProvider));
    if (needsApproval && !(context?.durable && (risk !== "read" || tool.externalEffects === true))) {
      if (!context?.approve || !await context.approve({ tool: name, plugin, account: identity, description: tool.description, input: structuredClone(input), risk, cloudProvider: context.cloudProvider }, signal)) throw new Error("Action refusée ou autorisation manquante.");
      assertAccount();
      await context.onEvent?.({ tool: name, plugin, status: "approved" });
    }
    assertAccount();
    if (context?.verifyConnection && await context.verifyConnection(plugin, signal) !== identity) throw new Error("Le compte connecté a changé. Approuve à nouveau l’action.");
    await context?.onEvent?.({ tool: name, plugin, status: "started" });
    const operation=async()=>{
      assertAccount();
      if(context?.verifyConnection&&await context.verifyConnection(plugin,signal)!==identity)throw Error("Le compte connecté a changé avant l’exécution. Approuve à nouveau l’action.");
      assertAccount();
      let result:unknown;
      for(let attempt=0;attempt<2;attempt++)try{result=await tool.execute(input,signal);break;}catch(error){
        if(attempt||risk!=="read"||tool.externalEffects||!/[Hh][Tt][Tt][Pp] (?:502|503|504)|fetch failed|ECONNRESET|network error/i.test(error instanceof Error?error.message:""))throw error;
        assertAccount();
        await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason??new DOMException("Annulé","AbortError"));};const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},150);signal.addEventListener("abort",abort,{once:true});});assertAccount();
      }
      assertAccount();
      if(tool.outputSchema&&validateToolParameters(result,tool.outputSchema).length)throw Error("Le résultat de l’outil ne respecte pas son contrat. Achèvement non confirmé.");
      await tool.verify?.(input,result,signal);assertAccount();
      await context?.onEvent?.({ tool: name, plugin, status: "completed" });
      return result;
    };
    try {return context?.durable?await context.durable.execute(tool,input,identity,signal,operation):await operation();} catch (error) {
      await context?.onEvent?.({ tool: name, plugin, status: "failed" });
      throw error;
    }
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
