import type { AgentProject, ContextBudget, RepositoryFile, RepositoryIndex, SelectedFile, SelectedProjectContext, SolarIntent } from "./types.ts";

const extensions: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript React", js: "JavaScript", jsx: "JavaScript React", mjs: "JavaScript", cjs: "JavaScript", rs: "Rust", swift: "Swift", py: "Python", json: "JSON", css: "CSS", html: "HTML", md: "Markdown", toml: "TOML", yaml: "YAML", yml: "YAML" };
const manifest = /(^|\/)(package\.json|Cargo\.toml|Package\.swift|pyproject\.toml|README\.md)$/i;
const indexCache = new Map<string, RepositoryIndex>();
const normalized = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function buildRepositoryIndex(project: AgentProject): RepositoryIndex {
  const paths = project.files.filter(path => !/(^|\/)(?:node_modules|dist|build|target|vendor|\.git)(\/|$)/.test(path)).slice(0, 2000);
  const signature = `${project.id}:${paths.length}:${paths.join("\n")}`;
  const cached = indexCache.get(project.id);
  if (cached?.signature === signature) return cached;
  const files: RepositoryFile[] = paths.map(path => ({ path, language: extensions[path.split(".").at(-1)?.toLowerCase() ?? ""] ?? "text" }));
  const rootDirs = new Map<string, number>();
  for (const { path } of files) { const dir = path.includes("/") ? path.split("/")[0] : "."; rootDirs.set(dir, (rootDirs.get(dir) ?? 0) + 1); }
  const architectureSummary = `Projet ${project.name}. ${files.length} fichiers indexés. Dossiers principaux : ${[...rootDirs].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([dir, count]) => `${dir} (${count})`).join(", ")}. Manifestes : ${files.filter(file => manifest.test(file.path)).slice(0, 8).map(file => file.path).join(", ") || "aucun"}.`;
  const index = { files, architectureSummary, signature };
  indexCache.set(project.id, index);
  return index;
}

function scorePath(path: string, words: string[], preferred: Set<string>) {
  const value = normalized(path);
  const base = value.split("/").at(-1) ?? value;
  let score = preferred.has(path) ? 100 : 0;
  for (const word of words) {
    if (word.length < 3) continue;
    if (base.includes(word)) score += Math.min(18, word.length * 2);
    else if (value.includes(word)) score += Math.min(9, word.length);
  }
  if (manifest.test(path)) score += 2;
  score -= path.split("/").length * 0.2;
  return score;
}

function excerpt(content: string, words: string[], charLimit: number) {
  if (content.length <= charLimit) return content;
  const lines = content.split("\n");
  const positions = lines.flatMap((line, index) => words.some(word => word.length > 3 && normalized(line).includes(word)) ? [index] : []);
  const keep = new Set<number>();
  for (let index = 0; index < Math.min(lines.length, 18); index++) keep.add(index);
  for (const position of positions.slice(0, 24)) for (let index = Math.max(0, position - 5); index <= Math.min(lines.length - 1, position + 9); index++) keep.add(index);
  let output = ""; let previous = -2;
  for (const index of [...keep].sort((a, b) => a - b)) {
    const line = `${index + 1}: ${lines[index]}\n`;
    if (output.length + line.length > charLimit) break;
    if (index > previous + 1) output += "…\n";
    output += line; previous = index;
  }
  return `${output}\n[Extrait seulement : lire le fichier complet avant de le modifier.]`;
}

export async function selectProjectContext(intent: SolarIntent, project: AgentProject, index: RepositoryIndex, budget: ContextBudget, signal: AbortSignal, maxFiles: number): Promise<SelectedProjectContext> {
  const charactersPerToken=budget.charactersPerToken??3.5;
  const words = [...new Set(normalized(intent.objective).split(/[^a-z0-9_.-]+/).filter(word => word.length > 2))].slice(0, 80);
  const preferred = new Set(project.preferredFiles ?? []);
  const ranking = index.files.map(file => ({ path: file.path, score: scorePath(file.path, words, preferred) })).sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  const direct = ranking.filter(item => item.score > 2);
  const selected = (direct.length ? direct : ranking.filter(item => manifest.test(item.path))).slice(0, Math.min(maxFiles, 10));
  const fileBudget = budget.fileCharacters??Math.max(2000, Math.floor((budget.maximumTokens - budget.reservedForGeneration - budget.reservedForSystem) * charactersPerToken) - intent.objective.length - intent.constraints.join(" ").length);
  let remaining = fileBudget;
  const files: SelectedFile[] = [];
  for (const item of selected) {
    signal.throwIfAborted();
    if (remaining < 800) break;
    const content = await project.readFile(item.path, signal);
    const allowance = Math.min(remaining, Math.max(800, Math.floor(fileBudget / Math.max(1, selected.length))));
    files.push({ path: item.path, content: excerpt(content, words, allowance), score: item.score });
    remaining -= files.at(-1)!.content.length;
  }
  return { files, architectureSummary: index.architectureSummary, relatedPaths: ranking.slice(0, 30).map(item => item.path), estimatedTokens: Math.ceil((fileBudget - remaining + intent.objective.length) / charactersPerToken), budget: budget.maximumTokens };
}
