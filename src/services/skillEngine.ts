export type SkillCategory = "design" | "presentation" | "engineering" | "orchestration";
export type ModelClass = "solar-4b" | "solar-9b" | "solar-12b" | "cloud" | "other-local";

export interface SolarSkill {
  id: string;
  name: string;
  version: string;
  category: SkillCategory;
  priority: "critical" | "high" | "medium" | "low";
  triggers: string[];
  compatibleSkills: string[];
  scope: string[];
  description: string;
  content: string;
}

export interface SkillRouteInput {
  prompt: string;
  conversationContext?: string;
  workMode?: boolean;
  artifact?: boolean;
  attachments?: boolean;
  modelName?: string;
  providerProtocol?: string;
  maxChars?: number;
  skillsMode?: "auto" | "manual";
  manualSkillIds?: string[];
}

export interface SelectedSkill { skill: SolarSkill; reason: string; injectedContent: string }
export interface SkillRoute { modelClass: ModelClass; selected: SelectedSkill[]; instruction: string; budget: number }

// Keep this as a direct import.meta.glob call: Vite rewrites the Markdown
// imports into the production bundle. Aliasing import.meta.glob leaves it
// undefined in the packaged app, which made the Skills directory appear empty.
let sourceFiles: Record<string, string> = {};
try {
  // Vite replaces this direct call with the bundled Markdown contents. The
  // try/catch only lets the same pure router load in Node contract tests.
  sourceFiles = import.meta.glob("../skills/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
} catch { /* import.meta.glob is only provided by Vite. */ }

function parseFrontmatter(source: string): { metadata: Record<string, string | string[]>; content: string } {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) throw new Error("Frontmatter Markdown absent.");
  const metadata: Record<string, string | string[]> = {};
  let activeArray: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.+?)\s*$/);
    if (item && activeArray) { (metadata[activeArray] as string[]).push(item[1].replace(/^['"]|['"]$/g, "")); continue; }
    const field = line.match(/^([a-z_]+):\s*(.*?)\s*$/i);
    if (!field) continue;
    const [, key, raw] = field;
    if (!raw) { metadata[key] = []; activeArray = key; }
    else { metadata[key] = raw.replace(/^['"]|['"]$/g, ""); activeArray = null; }
  }
  return { metadata, content: source.slice(match[0].length).trim() };
}

function sectionText(body: string, title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.match(new RegExp(`^#{1,3}\\s+[^\\n]*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|$)`, "im"))?.[1]?.trim() ?? "";
}

function summary(body: string) {
  const purpose = sectionText(body, "Purpose") || body;
  return purpose.replace(/^#+\s.*$/gm, "").replace(/\s+/g, " ").trim().slice(0, 230);
}

export function loadBundledSkills(files: Record<string, string> = sourceFiles): { skills: SolarSkill[]; errors: string[] } {
  const skills: SolarSkill[] = [];
  const errors: string[] = [];
  for (const [path, source] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      const { metadata, content } = parseFrontmatter(source);
      const getString = (key: string) => typeof metadata[key] === "string" ? metadata[key] as string : "";
      const getArray = (key: string) => Array.isArray(metadata[key]) ? metadata[key] as string[] : [];
      const id = getString("id"), name = getString("name"), category = getString("category");
      if (!id || !name || !content || !["design", "presentation", "engineering", "orchestration"].includes(category)) throw new Error("Métadonnées obligatoires manquantes.");
      const priority = getString("priority");
      skills.push({ id, name, version: getString("version") || "1.0", category: category as SkillCategory,
        priority: (["critical", "high", "medium", "low"].includes(priority) ? priority : "medium") as SolarSkill["priority"],
        triggers: getArray("triggers"), compatibleSkills: getArray("compatible_with"), scope: getArray("scope"),
        description: summary(content), content });
    } catch (error) { errors.push(`${path}: ${error instanceof Error ? error.message : "fichier invalide"}`); }
  }
  return { skills, errors };
}

const loaded = loadBundledSkills();
export const solarSkills = loaded.skills;
export const skillLoadErrors = loaded.errors;

export function classifyModel(modelName = "", providerProtocol = "") : ModelClass {
  if (providerProtocol !== "ollama") return providerProtocol ? "cloud" : "other-local";
  const text = modelName.toLowerCase();
  if (/solar[-_ ]?4b|qwen3[-_. ]?4b/.test(text)) return "solar-4b";
  if (/solar[-_ ]?9b|ornith.*9b/.test(text)) return "solar-9b";
  if (/solar[-_ ]?12b|gemma.*12b/.test(text)) return "solar-12b";
  return "other-local";
}

const patterns: Record<string, RegExp> = {
  coding: /\b(code|coding|program|programming|develop|developer|implement|refactor|repository|repo|typescript|javascript|python|rust|swift|component|fonctionnalit|dévelop|code|coder|programme|implémente|implémenter|refactor|dépôt|fichier|fonction)\b/i,
  debugging: /\b(debug|debugging|bug|crash|error|exception|broken|fail(?:ing)?|regression|does not work|not working|fix|débog|erreur|plante|bloque|marche pas|ne fonctionne|corrige|répare|régression|échec)\b/i,
  uiDesign: /\b(ui|ux|interface|design|layout|dashboard|screen|page|visual|style|redesign|minimal|premium|appearance|interface|maquette|écran|mise en page|visuel|graphique|apparence)\b/i,
  motion: /\b(animation|animate|motion|transition|hover|fade|spring|microinteraction|mouvement|anim|fondu|survol|transition)\b/i,
  presentation: /\b(presentation|presentation|powerpoint|pptx|slides?|deck|diaporama|diapo|présentation|exposé|expose|discours)\b/i,
  presentationAnimation: /\b(animate|animation|transition|reveal|staged|progressive|anim|transition|apparition|dévoilement)\b/i,
  artifact: /\b(artifact|deliverable|prototype|create|build|generate|file|document|app|artefact|crée|génère|construis|produis|fichier|document|prototype)\b/i,
};

function priorityValue(priority: SolarSkill["priority"]) { return ({ critical: 4, high: 3, medium: 2, low: 1 })[priority]; }

function routeIds(input: SkillRouteInput, modelClass: ModelClass) {
  const current = input.prompt.trim();
  const context = input.conversationContext?.trim() ?? "";
  const text = `${current}\n${context}`;
  const present = (key: keyof typeof patterns) => patterns[key].test(current) || (context.length > 0 && patterns[key].test(context));
  const ids = new Set<string>();
  const reasons = new Map<string, string>();
  const add = (id: string, reason: string) => { if (!ids.has(id)) { ids.add(id); reasons.set(id, reason); } };

  if (input.skillsMode === "manual") {
    for (const id of input.manualSkillIds ?? []) add(id, "sélection manuelle pour cette session");
    return { ids, reasons, modelClass };
  }

  if (input.workMode || present("coding") || input.attachments && /\.(?:tsx?|jsx?|rs|py|swift|go|java|css|html)\b/i.test(text)) add("solar.software-engineer", input.workMode ? "Mode Solar Code" : "demande de développement ou de modification de code");
  if (present("debugging")) { add("solar.debugging", "symptôme, erreur ou demande de correction"); add("solar.software-engineer", "correction technique"); }
  if (present("uiDesign")) add("solar.premium-ui-design", "demande de conception d’interface");
  if (present("motion")) { add("solar.motion-design", "demande de mouvement ou d’animation"); add("solar.premium-ui-design", "conception de l’interface animée"); }
  if (present("presentation")) { add("solar.presentation-design", "création ou modification d’une présentation"); add("solar.artifact-builder", "livrable de présentation"); }
  if (present("presentation") && present("presentationAnimation")) add("solar.presentation-animation", "animations de diapositives demandées");
  if (input.artifact || present("artifact") && (present("coding") || present("uiDesign") || present("presentation") || input.attachments)) add("solar.artifact-builder", "production d’un livrable complet");
  if (input.attachments && ids.has("solar.software-engineer")) add("solar.artifact-builder", "fichiers du projet à modifier");

  return { ids, reasons, modelClass };
}

function compactFor(skill: SolarSkill, modelClass: ModelClass, charBudget: number) {
  if (modelClass === "cloud") return skill.content.slice(0, charBudget);
  const sections = skill.content.split(/(?=^#{1,3}\s)/m).filter(Boolean);
  const desired = modelClass === "solar-4b"
    ? [/purpose/i, /golden rules|core principles|must.follow|important rules/i, /playbook|standard engineering loop|workflow|execution graph/i, /quality gate|quality check|acceptance criteria/i]
    : modelClass === "solar-9b"
      ? [/purpose/i, /core principles|golden rules|important rules/i, /playbook|workflow|standard engineering loop/i, /recipe|relevant/i, /anti.pattern/i, /quality gate|quality check|acceptance criteria/i]
      : [/purpose/i, /core principles|golden rules/i, /workflow|playbook|standard engineering loop/i, /important rules|anti.pattern/i, /quality gate|quality check|acceptance criteria/i];
  const chosen: string[] = [];
  for (const pattern of desired) {
    const section = sections.find(part => pattern.test(part.slice(0, part.indexOf("\n"))));
    if (section && !chosen.includes(section)) chosen.push(section);
  }
  const core = chosen.length ? chosen : sections.slice(0, 3);
  let result = "";
  for (const section of core) {
    const remaining = charBudget - result.length;
    if (remaining < 100) break;
    result += `${result ? "\n\n" : ""}${section.slice(0, remaining)}`;
  }
  return result || skill.content.slice(0, charBudget);
}

export function routeSkills(input: SkillRouteInput, registry: SolarSkill[] = solarSkills): SkillRoute {
  const modelClass = classifyModel(input.modelName, input.providerProtocol);
  const budget = input.maxChars ?? ({ "solar-4b": 3200, "solar-9b": 5600, "solar-12b": 7600, cloud: 10000, "other-local": 4600 } as const)[modelClass];
  const route = routeIds(input, modelClass);
  const selectedSkills = registry.filter(skill => route.ids.has(skill.id)).sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority));
  const selected: SelectedSkill[] = [];
  let remaining = budget;
  for (const skill of selectedSkills) {
    if (remaining < 180) break;
    const reserve = selectedSkills.length > selected.length + 1 ? 160 : 0;
    const body = compactFor(skill, modelClass, Math.max(180, Math.min(skill.content.length, remaining - reserve)));
    selected.push({ skill, reason: route.reasons.get(skill.id) ?? "contexte de la tâche", injectedContent: body });
    remaining -= body.length + skill.name.length + 28;
  }
  const modelNotes: Record<ModelClass, string> = {
    "solar-4b": "Modèle local compact : applique ces règles directement, garde le plan court et traite seulement les fichiers et éléments utiles à la demande.",
    "solar-9b": "Modèle local intermédiaire : planifie brièvement, modifie les éléments ciblés et vérifie le résultat avant de répondre.",
    "solar-12b": "Modèle local : adapte le niveau de détail à la tâche et vérifie les références entre les éléments modifiés.",
    cloud: "Adapte la profondeur des consignes à la tâche et conserve le contexte utile sans répéter les règles.",
    "other-local": "Modèle local : donne des consignes ciblées et réserve le contexte aux fichiers nécessaires à la tâche.",
  };
  const instruction = selected.map(({ skill, reason, injectedContent }) => `
[Skill Solar · ${skill.name} · ${skill.version}]
Sélectionné pour : ${reason}.
${injectedContent}`).join("\n").slice(0, budget);
  return { modelClass, selected, instruction: instruction ? `${modelNotes[modelClass]}\n${instruction}`.slice(0,budget) : "", budget };
}
