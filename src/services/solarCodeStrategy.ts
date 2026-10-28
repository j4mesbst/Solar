import type { Message } from "../domain/types";
import type { PerformanceProfile } from "../domain/extensions";
import { classifyModel, type ModelClass } from "./skillEngine.ts";

export type InternalCodeStrategy = "fast" | "balanced" | "deep";
export interface CodeStrategyInput { prompt: string; modelName: string; protocol: string; availableMemory?: number; performanceProfile?: PerformanceProfile; attachments?: number; }

export function chooseSolarCodeStrategy(input: CodeStrategyInput): { strategy: InternalCodeStrategy; modelClass: ModelClass; instruction: string } {
  const modelClass = classifyModel(input.modelName, input.protocol);
  const text = input.prompt.toLocaleLowerCase();
  let complexity = Math.min(5, Math.floor(input.prompt.trim().split(/\s+/).length / 28));
  if (/plusieurs fichiers|multi[- ]fichier|architecture|refactor|migration|auth|database|base de données|state management|end.to.end|de bout en bout/i.test(text)) complexity += 2;
  if (/bug|crash|régression|security|sécurité|concurren|race condition|performance/i.test(text)) complexity++;
  complexity += Math.min(2, input.attachments ?? 0);
  const lowMemory = input.availableMemory !== undefined && input.availableMemory < 6 * 2 ** 30;
  const eco = input.performanceProfile === "eco";
  const strategy: InternalCodeStrategy = !lowMemory && !eco && complexity >= 4 ? "deep" : complexity <= 1 || eco ? "fast" : "balanced";
  const instruction = strategy === "fast"
    ? "Stratégie Solar Chat — projets rapide : limite l’inspection aux fichiers concernés, effectue le changement direct et une vérification courte."
    : strategy === "deep"
      ? "Stratégie Solar Chat — projets approfondie : inspecte les contrats liés, découpe les changements en unités, puis vérifie syntaxe, imports, références croisées et cas d’erreur avant correction."
      : "Stratégie Solar Chat — projets équilibrée : inspecte les fichiers utiles, planifie brièvement, modifie le minimum nécessaire et vérifie les références affectées.";
  return { strategy, modelClass, instruction };
}

export function budgetConversation(messages: Message[], input: { modelName: string; protocol: string; availableMemory?: number; performanceProfile?: PerformanceProfile }) {
  const modelClass = classifyModel(input.modelName, input.protocol);
  const base = modelClass === "solar-4b" ? 10500 : modelClass === "solar-9b" ? 22000 : modelClass === "solar-12b" ? 30000 : modelClass === "cloud" ? 48000 : 17000;
  const free = input.availableMemory;
  const memoryFactor = free === undefined ? 1 : free < 4 * 2 ** 30 ? 0.45 : free < 8 * 2 ** 30 ? 0.68 : free < 16 * 2 ** 30 ? 0.85 : 1;
  const profileFactor = input.performanceProfile === "eco" ? 0.58 : input.performanceProfile === "performance" ? 1.25 : 1;
  const budget = Math.max(4500, Math.round(base * memoryFactor * profileFactor));
  const current = [...messages].reverse().find(message => message.role === "user");
  const selected: Message[] = current ? [current] : [];
  let remaining = Math.max(0, budget - (current?.content.length ?? 0));
  let cursor = messages.length - 1;
  if (current) cursor = messages.lastIndexOf(current) - 1;
  for (; cursor >= 0; cursor--) {
    const item = messages[cursor];
    if (item.role === "system") continue;
    const cap = item.role === "assistant" ? 2200 : 3200;
    const content = item.content.length > cap ? item.content.slice(-cap) : item.content;
    const cost = content.length + 80;
    if (cost > remaining) continue;
    selected.push({ ...item, content, attachments: item.role === "user" ? item.attachments : undefined });
    remaining -= cost;
  }
  const chronological = selected.reverse();
  const kept = new Set(chronological.map(message => message.id));
  const omitted = messages.filter(message => message.role === "user" && !kept.has(message.id)).slice(-12);
  const decisions = messages.filter(message => message.role === "assistant" && !kept.has(message.id)).flatMap(message => message.content.split(/\n/).filter(line => /\b(decision|décision|choisi|convenu|on garde|architecture|fichier|important)\b/i.test(line))).slice(-8);
  const memory = omitted.length || decisions.length
    ? `Mémoire compacte des échanges précédents (résumé automatique, à vérifier avec la demande actuelle) :\n${[...omitted.map(message => `- Demande : ${message.displayText ?? message.content}`), ...decisions.map(line => `- ${line}`)].map(text => text.slice(0, 220)).join("\n")}`
    : "";
  return { messages: chronological, memory, budget, modelClass };
}
