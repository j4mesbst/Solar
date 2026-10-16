import { buildRepositoryIndex, selectProjectContext } from "../agent/context.ts";
import { safeProjectPath } from "../agent/actions.ts";
import type { AgentFileChange, AgentProject, SelectedProjectContext, SolarIntent } from "../agent/types.ts";
import { semanticSource, initializeSemantic } from "./semantic.ts";
import { importMode,resolveLocalImport } from '../agent/module-resolution.ts';
import { CHARACTERS_PER_TOKEN,sourceSelectionBudget } from './budget.ts';

export interface SymbolInfo { name: string; kind: "function" | "class" | "type" | "method" | "export"; signature: string }
export interface GraphNode { path: string; hash: string; symbols: string[]; imports: string[]; calls: string[]; dependencies: string[]; details: SymbolInfo[] }
const cache = new Map<string, GraphNode>();
export function contentHash(text: string) { let hash = 2166136261; for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619); return (hash >>> 0).toString(16); }
export function inspectSource(path: string, text: string, paths: string[]): GraphNode {
  // Lightweight structural extraction is deliberately dependency-free. Tree-
  // sitter is not bundled in Solar today; this is a deterministic fallback
  // with conservative signatures rather than pretending to parse every AST.
  const details = [...text.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|struct|enum|interface|type|const|let|fn|func)\s+([A-Za-z_$][\w$]*)?([^\n{=;]*)/g)]
    .flatMap(match => {
      const name = match[2]; if (!name) return [];
      const raw = match[1];
      const kind: SymbolInfo["kind"] = /class|struct|enum/.test(raw) ? "class" : /interface|type/.test(raw) ? "type" : "function";
      return [{ name, kind, signature: `${raw} ${name}${match[3] ?? ""}`.trim().slice(0, 180) }];
    }).slice(0, 80);
  const symbols = details.map(detail => detail.name);
  const imports = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?|\brequire\s*\()\s*["']([^"']+)["']/g)].map(m => m[1]).slice(0, 50);
  const calls = [...new Set([...text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]))].slice(0, 50);
  const dependencies: string[] = [];
  for (const spec of imports.filter(i => i.startsWith("."))) {
    const expression=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?|\brequire\s*\()\s*["']([^"']+)["']/g)].find(match=>match[1]===spec)?.[0]??'';
    const target=resolveLocalImport(path,spec,paths,importMode(path,expression)).target;
    if (target) dependencies.push(target);
  }
  return { path, hash: contentHash(text), symbols, imports, calls, dependencies, details };
}

function scoreNode(node: GraphNode, words: Set<string>, preferred: Set<string>) {
  let score = preferred.has(node.path) ? 80 : 0;
  const haystack = `${node.path} ${node.symbols.join(" ")}`.toLowerCase();
  for (const word of words) if (word.length > 2 && haystack.includes(word)) score += 12;
  score += node.dependencies.length * 2;
  return score;
}

/** Compact structural overview kept stable across repair turns when files do
 * not change. It is an AST-like fallback, not a claim of a full parser. */
export function compactRepoMap(nodes: GraphNode[], objective: string, preferred: string[] = [], characterBudget = 3600) {
  const words = new Set(objective.toLowerCase().split(/[^\p{L}\p{N}_$]+/u).filter(Boolean));
  const preferredSet = new Set(preferred);
  const ranked = [...nodes].sort((a, b) => scoreNode(b, words, preferredSet) - scoreNode(a, words, preferredSet) || a.path.localeCompare(b.path));
  let output = "RepoMap (signatures structurelles compactes) :\n";
  for (const node of ranked) {
    const entry = `${node.path} #${node.hash}\n  ${node.details.slice(0, 8).map(detail => detail.signature).join("; ") || "(sans symbole exporté)"}${node.dependencies.length ? `\n  imports locaux: ${node.dependencies.join(", ")}` : ""}\n`;
    if (output.length + entry.length > characterBudget) break;
    output += entry;
  }
  return output;
}

export async function prepareContext(intent: SolarIntent, project: AgentProject, window: number, maxFiles: number, signal: AbortSignal, changes: AgentFileChange[] = [], semantic = true, focusPaths: string[] = []): Promise<SelectedProjectContext> {
  if(semantic)await initializeSemantic();
  const staged = new Map(changes.map(c => [c.path, c.after]));
  const nodes: GraphNode[] = [];
  const view: AgentProject = { ...project, preferredFiles: [...new Set([...focusPaths,...(project.preferredFiles??[])])].filter(safeProjectPath), files: [...new Set([...project.files, ...staged.keys()])].filter(safeProjectPath), readFile: async (path, abort) => {
    const text = staged.get(path) ?? await project.readFile(path, abort);
    const key = `${project.id}:${semantic}:${contentHash(view.files.join("\n"))}:${path}`, hash = contentHash(text);
    let node = cache.get(key);
    if (!node || node.hash !== hash) { node = inspectSource(path, text, view.files); if(semantic){const ast=semanticSource(path,text);node.symbols=[...new Set([...node.symbols,...ast.symbols.map(s=>s.name)])];node.details.push(...ast.symbols.map(s=>({name:s.name,kind:"function" as const,signature:`${s.kind} ${s.name} [${s.id}] ${s.editable?"édition AST":"lecture seule; édition par plage gardée si nécessaire"}`})));} cache.set(key, node); }
    nodes.push(node);
    while (cache.size > 500) cache.delete(cache.keys().next().value!);
    return text;
  } };
  const selectionCharacters=sourceSelectionBudget(window);
  const context = await selectProjectContext(intent, view, buildRepositoryIndex(view), { maximumTokens: window, reservedForGeneration: 0, reservedForSystem: 0,charactersPerToken:CHARACTERS_PER_TOKEN,fileCharacters:selectionCharacters }, signal, maxFiles);
  let room = Math.max(0,selectionCharacters-context.files.reduce((n,file)=>n+file.content.length,0));
  const dependencies = [...new Set(nodes.flatMap(n => n.dependencies))];
  for (const path of dependencies) {
    if (context.files.length >= maxFiles || context.files.some(f => f.path === path) || room < 500) continue;
    signal.throwIfAborted();
    const source=await view.readFile(path,signal),maximum=Math.min(room,5000);
    const content = source.length>maximum?source.slice(0,Math.max(0,maximum-100))+'\n[Extrait seulement : dépendance tronquée; lire la plage avant édition.]':source;
    context.files.push({ path, content, score: 5 }); room -= content.length;
  }
  // Make the graph real even when the first context pass only selected a few
  // files: inspect bounded relevant paths and cache by workspace+content hash.
  for (const path of context.relatedPaths.slice(0, Math.max(12, maxFiles * 3))) {
    if (nodes.some(node => node.path === path)) continue;
    try { await view.readFile(path, signal); } catch { signal.throwIfAborted(); /* unreadable files are never injected */ }
  }
  context.architectureSummary += "\n" + compactRepoMap(nodes, intent.objective, view.preferredFiles);
  for(const file of context.files)file.sourceHash=nodes.find(node=>node.path===file.path)?.hash;
  context.estimatedTokens = Math.ceil((context.files.reduce((n, f) => n + f.content.length, 0) + context.architectureSummary.length + intent.objective.length) / CHARACTERS_PER_TOKEN);
  return context;
}
