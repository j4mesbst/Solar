import type { AgentComplexity, AgentMode, AgentModelProfile, SolarIntent } from "./types.ts";

const code = /\b(code|coder|coding|fichier|file|fonction|function|composant|component|module|repository|repo|dépôt|projet|project|typescript|javascript|python|swift|rust|react|api|refactor|refactorise)\b|(?:^|\s)(?:src\/)?[\w.-]+\.(?:ts|tsx|js|jsx|cjs|mjs|rs|swift)\b/i;
const change = /\b(ajoute|ajouter|crée|créer|modifie|modifier|change|remplace|implémente|implement|add|create|edit|replace|refactor(?:ise|iser)?|déplace(?:r)?|extrais|extraire|extract|move|fix|corrige|corriger|répare|réparer|anime|animer|reproduis|reproduire|construis|construire|transforme|transformer)\b/i;
const bug = /\b(bug|erreur|error|crash|échec|failed|failure|régression|regression|ne fonctionne|marche pas|corrige|répare|debug|débog)/i;
const ui = /\b(interface|ui|ux|page|écran|screen|design|style|animation|sidebar|bouton|button)\b/i;
const artifact = /\b(artefact|artifact|présentation|slides?|diapo|document|graphique|diagramme|prototype|livrable)\b/i;

export function analyzeIntent(prompt: string, priorContext = ""): SolarIntent {
  const objective = prompt.trim().slice(0, 4000);
  const changing=change.test(objective)||/\b(?:mets|mettre|set)\b.+(?:\b(?:valeur|value|to|sur)\b|à\s+\S)/i.test(objective);
  const needsRepositoryAccess = code.test(objective) || changing || bug.test(objective);
  const taskType = bug.test(objective) ? "debugging" : artifact.test(objective) ? "artifactGeneration" : ui.test(objective) && changing ? "uiGeneration" : changing && code.test(objective) ? "codeModification" : changing ? "codeGeneration" : needsRepositoryAccess ? "repositoryTask" : "question";
  const constraints = objective.split(/\n/).map(line => line.trim()).filter(line => /^(?:[-*]|\d+\.)\s+/.test(line) || /\b(sans|uniquement|seulement|ne .* pas|do not|must|garde|préserve|respecte)\b/i.test(line)).slice(0, 20).map(line => line.slice(0, 500));
  const words = objective.split(/\s+/).filter(Boolean);
  const missingTarget = needsRepositoryAccess && change.test(objective) && !/\b(src|app|page|composant|component|module|fichier|file|fonction|function|bouton|button|menu|dialog|formulaire|chat|sidebar|settings|paramètres)\b/i.test(`${objective} ${priorContext}`);
  return { taskType, objective, constraints, needsRepositoryAccess, needsClarification: words.length < 8 && missingTarget, expectedArtifact: artifact.test(objective) ? "artefact" : undefined };
}

export function analyzeComplexity(intent: SolarIntent, fileCount: number, model: AgentModelProfile): AgentComplexity {
  const words = intent.objective.split(/\s+/).length;
  let score = words > 100 ? 3 : words > 35 ? 2 : words > 12 ? 1 : 0;
  if (fileCount > 2) score++;
  if (fileCount > 6) score++;
  if (intent.taskType === "debugging" || intent.taskType === "artifactGeneration") score++;
  if (/\b(architecture|migration|refactor|multi[- ]fichier|plusieurs fichiers|dépendance|concurren|performance|sécurité)\b/i.test(intent.objective)) score += 2;
  if (model.parameterClass === "small" && score > 0) score++;
  return score <= 0 ? "trivial" : score <= 1 ? "simple" : score <= 3 ? "medium" : "complex";
}

export function resolveMode(complexity: AgentComplexity, model: AgentModelProfile, forced?: AgentMode): AgentMode {
  if (forced) return forced;
  if (complexity === "trivial" || complexity === "simple") return "fast";
  if (complexity === "complex" && model.parameterClass !== "small") return "deep";
  return "balanced";
}
