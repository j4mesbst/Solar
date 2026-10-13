import type { AgentAction, AgentActionResponse, AgentFileChange, AgentProject } from "./types.ts";

const forbiddenPart = /(?:^|\/)(?:\.\.?|\.git|\.env(?:\..*)?|node_modules|target|dist|build|vendor)(?:\/|$)/i;
const privatePart = /(?:secret|credential|password|token|private[-_]?key|\.pem$|\.key$)/i;
export function safeProjectPath(path: string) {
  return Boolean(path && path.length <= 240 && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") && !forbiddenPart.test(path) && !privatePart.test(path) && path.split("/").every(part => part && part !== "." && part !== ".." && !part.startsWith(".")));
}

export const agentActionSchema = {
  type: "object", properties: {
    actions: { type: "array", maxItems: 8, items: { type: "object", properties: {
      type: { type: "string", enum: ["readFile", "searchCode", "patchFile", "createFile", "replaceFile", "finish"] },
      path: { type: "string" }, query: { type: "string" }, oldText: { type: "string" }, newText: { type: "string" }, content: { type: "string" }, message: { type: "string" },
    }, required: ["type"], additionalProperties: false } }, finalMessage: { type: "string" },
  }, required: ["actions"], additionalProperties: false,
} as const;

function stripFence(source: string) {
  const trimmed = source.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : trimmed;
}
function stripTrailingCommas(source: string) {
  let result = "", inString = false, escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inString) { result += char; if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') { inString = true; result += char; continue; }
    if (char === "," && /^[\s]*[}\]]/.test(source.slice(index + 1))) continue;
    result += char;
  }
  return result;
}

export function parseAgentResponse(raw: string): AgentActionResponse {
  if (raw.length > 600_000) throw new Error("Réponse structurée trop volumineuse.");
  const source = stripFence(raw);
  let data: unknown;
  try { data = JSON.parse(source); }
  catch { try { data = JSON.parse(stripTrailingCommas(source)); } catch { throw new Error("JSON d’actions invalide : régénération structurée nécessaire."); } }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Réponse d’actions invalide.");
  const value = data as Record<string, unknown>;
  if (!Array.isArray(value.actions) || value.actions.length > 8 || (value.finalMessage !== undefined && typeof value.finalMessage !== "string")) throw new Error("Schéma d’actions invalide.");
  const actions = value.actions.map((entry): AgentAction => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Action invalide.");
    const action = entry as Record<string, unknown>;
    const text = (name: string) => { if (typeof action[name] !== "string") throw new Error(`Champ ${name} manquant dans l’action.`); return action[name] as string; };
    switch (action.type) {
      case "readFile": return { type: "readFile", path: text("path") };
      case "searchCode": return { type: "searchCode", query: text("query") };
      case "patchFile": return { type: "patchFile", path: text("path"), oldText: text("oldText"), newText: text("newText") };
      case "createFile": return { type: "createFile", path: text("path"), content: text("content") };
      case "replaceFile": return { type: "replaceFile", path: text("path"), content: text("content") };
      case "runCommand": return { type: "runCommand", command: text("command") };
      case "runTests": return { type: "runTests", target: typeof action.target === "string" ? action.target : undefined };
      case "finish": return { type: "finish", message: text("message") };
      default: throw new Error("Type d’action non autorisé.");
    }
  });
  return { actions, finalMessage: value.finalMessage as string | undefined };
}

export function validateAction(action: AgentAction, project: AgentProject, staged: ReadonlyMap<string, AgentFileChange>, allowChanges: boolean): string | null {
  if (action.type === "runCommand" || action.type === "runTests") return "Les commandes proposées par le modèle ne sont jamais exécutées.";
  if (action.type === "finish") return action.message.length > 5000 ? "Message final trop long." : null;
  if (action.type === "searchCode") return action.query.length > 120 || action.query.length < 2 ? "Recherche hors limites." : null;
  if (!safeProjectPath(action.path)) return "Chemin de projet interdit.";
  const exists = project.files.includes(action.path) || staged.has(action.path);
  if (action.type === "readFile") return exists ? null : "Fichier demandé absent de l’index.";
  if (!allowChanges) return "Les changements de fichiers sont désactivés.";
  if (action.type === "createFile") {
    if (exists) return "Le fichier à créer existe déjà.";
    const parent = action.path.includes("/") ? action.path.slice(0, action.path.lastIndexOf("/")) : "";
    if (parent && !project.files.some(path => path.startsWith(`${parent}/`))) return "Crée le fichier dans un dossier du projet déjà indexé.";
    if (action.content.length > 120_000) return "Fichier créé trop volumineux.";
  } else {
    if (!exists) return "Le fichier à modifier n’existe pas. Lis l’index avant de proposer un patch.";
    if (action.type === "patchFile" && (!action.oldText || action.oldText.length > 40_000 || action.newText.length > 60_000)) return "Patch invalide ou trop volumineux.";
    if (action.type === "replaceFile" && action.content.length > 120_000) return "Remplacement trop volumineux.";
  }
  const content = action.type === "patchFile" ? action.newText : action.type === "createFile" || action.type === "replaceFile" ? action.content : "";
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b/i.test(content)) return "Le contenu paraît inclure un secret privé.";
  return null;
}

export async function stageAction(action: AgentAction, project: AgentProject, staged: Map<string, AgentFileChange>, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (action.type === "finish") return action.message;
  if (action.type === "searchCode") {
    const query = action.query.toLocaleLowerCase(); const hits: string[] = [];
    const ranked = [...project.files].filter(safeProjectPath).sort((a, b) =>
      Number(b.toLocaleLowerCase().includes(query)) - Number(a.toLocaleLowerCase().includes(query))
      || Number(project.preferredFiles?.includes(b) ?? false) - Number(project.preferredFiles?.includes(a) ?? false));
    for (const path of ranked.slice(0, 80)) {
      signal.throwIfAborted();
      if (path.toLocaleLowerCase().includes(query)) { hits.push(path); }
      if (hits.length < 12) {
        try {
          const source = (staged.get(path)?.after ?? await project.readFile(path, signal)).slice(0, 80_000);
          const line = source.split("\n").findIndex(value => value.toLocaleLowerCase().includes(query));
          if (line >= 0) hits.push(`${path}:${line + 1}: ${source.split("\n")[line].trim().slice(0, 180)}`);
        } catch (error) { if (signal.aborted) throw error; }
      }
      if (hits.length >= 12) break;
    }
    return hits.length ? `Résultats de recherche :\n${hits.slice(0, 12).join("\n")}` : "Aucun chemin ni contenu correspondant dans l’index borné.";
  }
  if (action.type === "runCommand" || action.type === "runTests") throw new Error("Commande modèle interdite.");
  const current = staged.get(action.path);
  if (action.type === "readFile") {
    const content = current?.after ?? await project.readFile(action.path, signal);
    return `Fichier ${action.path} :\n${content.slice(0, 24_000)}${content.length > 24_000 ? "\n[Suite omise : fichier volumineux.]" : ""}`;
  }
  const before = current?.before ?? (action.type === "createFile" ? "" : await project.readFile(action.path, signal));
  const value = current?.after ?? before;
  let after: string;
  if (action.type === "createFile" || action.type === "replaceFile") after = action.content;
  else {
    const first = value.indexOf(action.oldText);
    if (first < 0 || value.indexOf(action.oldText, first + action.oldText.length) >= 0) throw new Error(`Le patch de ${action.path} doit correspondre une seule fois au texte existant.`);
    after = value.slice(0, first) + action.newText + value.slice(first + action.oldText.length);
  }
  if (after.length > 512_000) throw new Error(`Le fichier ${action.path} dépasserait la limite de taille.`);
  if (after === before) staged.delete(action.path);
  else staged.set(action.path, { path: action.path, before, after, created: current?.created || action.type === "createFile" });
  return `${action.type === "createFile" ? "Création" : "Patch"} préparé pour ${action.path}; aucune écriture appliquée au projet.`;
}
