import type { AgentAction, AgentActionResponse, AgentFileChange, AgentProject } from "./types.ts";
import { atomicStage, atomicMutationTypes, validateAtomic } from "./atomic.ts";
import { initializeSemantic, semanticSource } from "../cortex/semantic.ts";
import { parseVisualValidation, visualValidationSchema } from "./visual-validation.ts";

const forbiddenPart = /(?:^|\/)(?:\.\.?|\.git|\.env(?:\..*)?|node_modules|target|dist|build|vendor)(?:\/|$)/i;
const privatePart = /(?:secret|credential|password|token|private[-_]?key|\.pem$|\.key$)/i;
export function safeProjectPath(path: string) {
  return Boolean(path && path.length <= 240 && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") && !forbiddenPart.test(path) && !privatePart.test(path) && path.split("/").every(part => part && part !== "." && part !== ".." && !part.startsWith(".")));
}

// Requiring the fields for each action matters for small local models: a
// generic object with only `type` required lets them emit a patch with a
// `query` (or a finish without a message), which cannot be staged.  `oneOf`
// turns the JSON schema into an executable contract rather than a hint.
const action = (type: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "object", properties: { type: { type: "string", enum: [type] }, ...properties }, required: ["type", ...required], additionalProperties: false,
});
const path = { type: "string", minLength: 1, maxLength: 240 };
const text = { type: "string" };
// Same small, deterministic hash used by the Cortex RepoMap. It is a stale
// source guard, not a cryptographic integrity primitive.
function sourceHash(text: string) { let hash = 2166136261; for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619); return (hash >>> 0).toString(16); }

export class PatchConflictError extends Error {
  readonly path: string;
  readonly matches: number;
  readonly currentHash: string;
  constructor(path: string, matches: number, currentHash: string) {
    super(`Le patch de ${path} doit correspondre une seule fois au texte existant (${matches === 0 ? "texte absent" : `${matches} occurrences`}, source #${currentHash}).`);
    this.name = "PatchConflictError";
    this.path=path;this.matches=matches;this.currentHash=currentHash;
  }
}
const standardActions = [
  action("readFile", { path }, ["path"]),
  action("searchCode", { query: { type: "string", minLength: 2, maxLength: 120 } }, ["query"]),
  action("patchFile", { path, oldText: text, newText: text }, ["path", "oldText", "newText"]),
  action("createFile", { path, content: text }, ["path", "content"]),
  action("replaceFile", { path, content: text }, ["path", "content"]),
  action("replaceSymbol", { path, symbol: { type: "string", minLength: 1, maxLength: 160 }, content: text, sourceHash: { type: "string", maxLength: 32 } }, ["path", "symbol", "content"]),
  action("finish", { message: { type: "string", minLength: 1, maxLength: 5000 } }, ["message"]),
] as const;
const responseSchema = (actions: readonly unknown[], requireDiagnosis = false) => ({
  type: "object", properties: { actions: { type: "array", maxItems: 8, items: { oneOf: actions } }, finalMessage: { type: "string" }, diagnosis:{type:"string",maxLength:1200},validation:visualValidationSchema }, required: requireDiagnosis?["actions","diagnosis"]:["actions"], additionalProperties: false,
});

export const agentActionSchema = responseSchema(standardActions);
export const cortexActionSchema = responseSchema([
  ...standardActions,
  action("readContext",{id:{type:'string',minLength:1,maxLength:100},start:{type:'integer',minimum:0},end:{type:'integer',minimum:1}},['id']),
  action("searchSymbol", { query: { type:"string", minLength:2, maxLength:120 } }, ["query"]),
  action("readSymbol", { symbolId: { type:"string", maxLength:300 } }, ["symbolId"]),
  action("readFileRange", { path, start:{type:"integer",minimum:1},end:{type:"integer",minimum:1} }, ["path","start","end"]),
  action("replaceRange", { path, start:{type:"integer",minimum:1},end:{type:"integer",minimum:1},content:text,sourceHash:text }, ["path","start","end","content","sourceHash"]),
  action("patchStyle", { path, selector:text, changes:{type:"object",additionalProperties:{type:"string"},minProperties:1,maxProperties:16},sourceHash:text }, ["path","selector","changes","sourceHash"]),
  action("applyPatch", { path,oldText:text,newText:text }, ["path","oldText","newText"]),
  action("runBuild", {}, []),
  action("runTests", {}, []),
  action("inspectUI", {path,viewport:{type:"object",properties:{width:{type:"integer",minimum:320,maximum:1920},height:{type:"integer",minimum:240,maximum:1200}},required:["width","height"],additionalProperties:false}}, ["path","viewport"]),
  action("inspectMotion", {path,timeline:{type:"array",minItems:5,maxItems:12,items:{type:"number",minimum:0,maximum:10000}},selector:{type:"string",maxLength:160}}, ["path","timeline"]),
  action("runCheck", { identifier: { type: "string", enum: ["build", "tests", "types"] } }, ["identifier"]),
  action("renderPreview", { path }, ["path"]),
  action("inspectRender", { path }, ["path"]),
]);
// Used only after a change task tried to finish without changing a file. This
// removes the tempting empty `finish` escape hatch for local models while the
// exact project excerpts are already in context.
export const cortexMutationSchema = responseSchema([
  action("patchFile", { path, oldText: text, newText: text }, ["path", "oldText", "newText"]),
  action("createFile", { path, content: text }, ["path", "content"]),
  action("replaceFile", { path, content: text }, ["path", "content"]),
  action("replaceSymbol", { path, symbol: { type: "string", minLength: 1, maxLength: 160 }, content: text, sourceHash: { type: "string", maxLength: 32 } }, ["path", "symbol", "content"]),
]);
export const cortexFirstArtifactSchema = responseSchema([
  action("createFile", { path, content: text }, ["path", "content"]),
  action("replaceFile", { path, content: text }, ["path", "content"]),
]);
export const cortexRepairSchema = responseSchema([
  ...cortexMutationSchema.properties.actions.items.oneOf,
  action("replaceRange", { path, start:{type:"integer",minimum:1},end:{type:"integer",minimum:1},content:text,sourceHash:text }, ["path","start","end","content","sourceHash"]),
  action("patchStyle", { path, selector:text, changes:{type:"object",additionalProperties:{type:"string"},minProperties:1,maxProperties:16},sourceHash:text }, ["path","selector","changes","sourceHash"]),
  action("applyPatch", { path,oldText:text,newText:text }, ["path","oldText","newText"]),
]);

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

export function parseAgentResponse(raw: string, options: { advisoryValidation?:boolean } = {}): AgentActionResponse {
  if (raw.length > 600_000) throw new Error("Réponse structurée trop volumineuse.");
  const source = stripFence(raw);
  let data: unknown;
  try { data = JSON.parse(source); }
  catch { try { data = JSON.parse(stripTrailingCommas(source)); } catch { throw new Error("JSON d’actions invalide : régénération structurée nécessaire."); } }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Réponse d’actions invalide.");
  const value = data as Record<string, unknown>;
  const unexpected=Object.keys(value).filter(key=>!["actions","finalMessage","diagnosis","validation"].includes(key));
  if(unexpected.length)throw Error(`Champ inattendu dans la réponse d’actions : ${unexpected.slice(0,4).join(', ').slice(0,160)}. Champs autorisés : actions, finalMessage, diagnosis, validation. Renvoie uniquement le JSON du schéma sans ajouter d'explication.`);
  if (!Array.isArray(value.actions) || value.actions.length > 8 || (value.finalMessage !== undefined && typeof value.finalMessage !== "string") || (value.diagnosis!==undefined&&typeof value.diagnosis!=="string")) throw new Error("Schéma d’actions invalide.");
  const actions = value.actions.map((entry): AgentAction => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Action invalide.");
    const action = entry as Record<string, unknown>;
    const fields:Record<string,string[]>={readContext:['id','start','end'],readFile:["path"],searchCode:["query"],patchFile:["path","oldText","newText"],createFile:["path","content"],replaceFile:["path","content"],replaceSymbol:["path","symbol","content","sourceHash"],runCommand:["command"],runTests:["target"],runBuild:[],runCheck:["identifier"],renderPreview:["path"],inspectRender:["path"],finish:["message"],searchSymbol:["query"],readSymbol:["symbolId"],readFileRange:["path","start","end"],replaceRange:["path","start","end","content","sourceHash"],patchStyle:["path","selector","changes","sourceHash"],applyPatch:["path","oldText","newText"],inspectUI:["path","viewport"],inspectMotion:["path","timeline","selector"]};
    if(typeof action.type!=="string"||!fields[action.type]||Object.keys(action).some(key=>key!=="type"&&!fields[action.type as string].includes(key)))throw Error("Type d’action ou champ non autorisé.");
    const text = (name: string) => { if (typeof action[name] !== "string") throw new Error(`Champ ${name} manquant dans l’action.`); return action[name] as string; };
    const integer = (name:string) => { if(!Number.isInteger(action[name]))throw Error(`Champ ${name} doit être entier.`);return action[name] as number; };
    switch (action.type) {
      case 'readContext': return {type:'readContext',id:text('id'),...(action.start!==undefined?{start:integer('start')}:{}),...(action.end!==undefined?{end:integer('end')}:{})};
      case "searchSymbol": return {type:"searchSymbol",query:text("query")};
      case "readSymbol": return {type:"readSymbol",symbolId:text("symbolId")};
      case "readFileRange": return {type:"readFileRange",path:text("path"),start:integer("start"),end:integer("end")};
      case "replaceRange": return {type:"replaceRange",path:text("path"),start:integer("start"),end:integer("end"),content:text("content"),sourceHash:text("sourceHash")};
      case "patchStyle": {
        if(!action.changes||typeof action.changes!=="object"||Array.isArray(action.changes)||!Object.values(action.changes).every(value=>typeof value==="string"))throw Error("Propriétés CSS invalides.");
        return {type:"patchStyle",path:text("path"),selector:text("selector"),changes:action.changes as Record<string,string>,sourceHash:text("sourceHash")};
      }
      case "applyPatch": return {type:"applyPatch",path:text("path"),oldText:text("oldText"),newText:text("newText")};
      case "readFile": return { type: "readFile", path: text("path") };
      case "searchCode": return { type: "searchCode", query: text("query") };
      case "patchFile": return { type: "patchFile", path: text("path"), oldText: text("oldText"), newText: text("newText") };
      case "createFile": return { type: "createFile", path: text("path"), content: text("content") };
      case "replaceFile": return { type: "replaceFile", path: text("path"), content: text("content") };
      case "replaceSymbol": return { type: "replaceSymbol", path: text("path"), symbol: text("symbol"), content: text("content"), sourceHash: typeof action.sourceHash === "string" ? action.sourceHash : undefined };
      case "runCommand": return { type: "runCommand", command: text("command") };
      case "runTests": return {type:"runCheck",identifier:"tests"};
      case "runBuild": return {type:"runCheck",identifier:"build"};
      case "inspectUI": {
        const view=action.viewport as Record<string,unknown>;if(!view||!Number.isInteger(view.width)||!Number.isInteger(view.height))throw Error("Viewport invalide.");
        return {type:"inspectUI",path:text("path"),viewport:{width:view.width as number,height:view.height as number}};
      }
      case "inspectMotion": {
        if(!Array.isArray(action.timeline)||!action.timeline.every(value=>typeof value==="number"&&Number.isFinite(value)))throw Error("Timeline invalide.");
        return {type:"inspectMotion",path:text("path"),timeline:action.timeline as number[],selector:typeof action.selector==="string"?action.selector:undefined};
      }
      case "runCheck": { const identifier = text("identifier"); if (!["build", "tests", "types"].includes(identifier)) throw new Error("Vérification non autorisée."); return { type: "runCheck", identifier: identifier as "build" | "tests" | "types" }; }
      case "renderPreview": return { type: "renderPreview", path: text("path") };
      case "inspectRender": return { type: "inspectRender", path: text("path") };
      case "finish": return { type: "finish", message: text("message") };
      default: throw new Error("Type d’action non autorisé.");
    }
  });
  let validation:AgentActionResponse['validation'],validationError:string|undefined;
  if(value.validation!==undefined){try{validation=parseVisualValidation(value.validation);}catch(error){if(!options.advisoryValidation)throw error;validationError=error instanceof Error?error.message:String(error);}}
  return { actions, finalMessage: value.finalMessage as string | undefined, diagnosis: value.diagnosis as string | undefined,validation,validationError };
}

export function validateAction(action: AgentAction, project: AgentProject, staged: ReadonlyMap<string, AgentFileChange>, allowChanges: boolean): string | null {
  if(action.type==='readContext'){
    if(!/^ctx-\d+-[a-f0-9]+$/.test(action.id))return 'Référence de contexte mal formée : utilise exactement un identifiant ctx-… annoncé comme récupérable.';
    if(action.start!==undefined&&(!Number.isInteger(action.start)||action.start<0)||action.end!==undefined&&(!Number.isInteger(action.end)||action.end<=0))return 'Plage de contexte mal formée : indices caractères entiers, start ≥ 0 et end > 0.';
    return null;
  }
  const atomicIssue=validateAtomic(action);if(atomicIssue)return atomicIssue;
  if(action.type==="searchSymbol"||action.type==="readSymbol")return atomicIssue??null;
  if (action.type === "runCommand" || action.type === "runTests") return "Les commandes proposées par le modèle ne sont jamais exécutées.";
  if (action.type === "runCheck") return ["build", "tests", "types"].includes(action.identifier) ? null : "Vérification interdite.";
  if (action.type === "finish") return action.message.length > 5000 ? "Message final trop long." : null;
  if (action.type === "searchCode") return action.query.length > 120 || action.query.length < 2 ? "Recherche hors limites." : null;
  if (!safeProjectPath(action.path)) return "Chemin de projet interdit.";
  const exists = project.files.includes(action.path) || staged.has(action.path);
  if (action.type === "readFile"||action.type==="readFileRange") return exists ? null : "Fichier demandé absent de l’index.";
  if(action.type==="inspectUI")return exists&&action.viewport.width>=320&&action.viewport.width<=1920&&action.viewport.height>=240&&action.viewport.height<=1200?null:"Inspection UI hors limites.";
  if(action.type==="inspectMotion")return exists&&action.timeline.length>=5&&action.timeline.length<=12&&action.timeline.every(time=>time>=0&&time<=10000)&&(!action.selector||action.selector.length<=160)?null:"Inspection temporelle hors limites.";
  if (action.type === "renderPreview" || action.type === "inspectRender") return exists && /\.html?$/i.test(action.path) ? null : "Le rendu initial accepte uniquement un fichier HTML autonome du projet.";
  if (!allowChanges) return "Les changements de fichiers sont désactivés.";
  if (action.type === "createFile") {
    if (exists) return "Le fichier à créer existe déjà.";
    const parent = action.path.includes("/") ? action.path.slice(0, action.path.lastIndexOf("/")) : "";
    if (parent && !project.files.some(path => path.startsWith(`${parent}/`))) return "Crée le fichier dans un dossier du projet déjà indexé.";
    if (action.content.length > 120_000) return "Fichier créé trop volumineux.";
  } else {
    if (!exists) return "Le fichier à modifier n’existe pas. Lis l’index avant de proposer un patch.";
    if ((action.type === "patchFile"||action.type==="applyPatch") && (!action.oldText || action.oldText.length > 40_000 || action.newText.length > 60_000)) return "Patch invalide ou trop volumineux.";
    if ((action.type === "replaceFile" || action.type === "replaceSymbol") && action.content.length > 120_000) return "Remplacement trop volumineux.";
  }
  const content = action.type === "patchFile"||action.type==="applyPatch" ? action.newText : action.type === "createFile" || action.type === "replaceFile" || action.type === "replaceSymbol"||action.type==="replaceRange" ? action.content : action.type==="patchStyle"?Object.values(action.changes).join("\n"):"";
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b/i.test(content)) return "Le contenu paraît inclure un secret privé.";
  return null;
}

function symbolRange(source: string, symbol: string): { start: number; end: number } | undefined {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function|class|interface|type|const|let|var|fn|func|struct|enum)\\s+${escaped}\\b[^\\n{=]*(?:=\\s*)?\\{?`, "m").exec(source);
  if (!match || match.index === undefined) return;
  const start = match.index;
  const brace = source.indexOf("{", start + match[0].length - 1);
  if (brace < 0) {
    const end = source.indexOf(";", start);
    return end < 0 ? undefined : { start, end: end + 1 };
  }
  let depth = 0, quote = "", escapedChar = false;
  for (let index = brace; index < source.length; index++) {
    const char = source[index];
    if (quote) { if (escapedChar) escapedChar = false; else if (char === "\\") escapedChar = true; else if (char === quote) quote = ""; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "{") depth++;
    if (char === "}" && --depth === 0) return { start, end: index + 1 };
  }
}

/** Deterministic V3 recovery for small-model tool slips. It never writes a
 * project: a translated replacement remains an approval-gated proposal. */
export async function normalizeProposedAction(action: AgentAction, project: AgentProject, staged: ReadonlyMap<string, AgentFileChange>, signal: AbortSignal) {
  if("path" in action&&!safeProjectPath(action.path))throw Error("Chemin de projet interdit.");
  if('sourceHash' in action&&typeof action.sourceHash==='string'&&/^#?[a-f0-9]{1,8}$/i.test(action.sourceHash))action={...action,sourceHash:action.sourceHash.replace(/^#/,'').toLowerCase()};
  // Some local models double-escape a complete HTML document inside the JSON
  // content field. Only normalize the unmistakable whole-document form: a
  // single physical line whose markup boundaries are written as literal \n.
  // Ordinary inline JavaScript strings and already formatted HTML stay intact.
  let note:string|undefined;
  if((action.type==="createFile"||action.type==="replaceFile")&&/\.html?$/i.test(action.path)&&!action.content.includes("\n")&&/<(?:!doctype\s+html|html\b)/i.test(action.content)&&/\\n\s*<(?:html|head|body|main|div)\b/i.test(action.content)){
    action={...action,content:action.content.replace(/\\n/g,"\n").replace(/\\"/g,'"')};
    note="Document HTML intégralement double-échappé normalisé avant vérification; source contrôlée dans la copie de travail.";
  }
  if (action.type !== "createFile" || !(project.files.includes(action.path) || staged.has(action.path))) return { action, note };
  if(staged.has(action.path))throw Error(`Création conflictuelle de ${action.path} : une modification est déjà proposée; relis sa version courante avant de la modifier.`);
  const existing = staged.get(action.path)?.after ?? await project.readFile(action.path, signal);
  if (!action.content.trim() || action.content === existing) return { action, note: "Création conflictuelle sans contenu nouveau : modification ciblée requise." };
  // The path was explicit, the file exists and content differs: converting the
  // proposal to a replaceFile keeps it reviewable and avoids a createFile loop.
  return { action: { type: "replaceFile", path: action.path, content: action.content } as AgentAction, note: [note,`Création conflictuelle normalisée en remplacement proposé pour ${action.path}.`].filter(Boolean).join(" ") };
}

export async function stageAction(action: AgentAction, project: AgentProject, staged: Map<string, AgentFileChange>, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if(action.type==='readContext')throw Error('La récupération nécessite le checkpoint Cortex; aucun accès externe accordé.');
  const atomic=await atomicStage(action,project,staged,signal);if(atomic!==undefined)return atomic;
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
  if (action.type === "runCheck" || action.type === "renderPreview" || action.type === "inspectRender"||action.type==="inspectUI"||action.type==="inspectMotion") throw new Error("Cette action nécessite le service d’exécution Cortex.");
  if (action.type === "searchSymbol"||action.type==="readSymbol"||action.type==="readFileRange"||atomicMutationTypes.includes(action.type)&&action.type!=="applyPatch")throw Error("Action atomique non exécutée.");
  const current = staged.get(action.path);
  if (action.type === "readFile") {
    const content = current?.after ?? await project.readFile(action.path, signal);
    return `Fichier ${action.path} :\n${content.slice(0, 24_000)}${content.length > 24_000 ? "\n[Suite omise : fichier volumineux.]" : ""}`;
  }
  const before = current?.before ?? (action.type === "createFile" ? "" : await project.readFile(action.path, signal));
  const value = current?.after ?? before;
  let after: string;
  if (action.type === "createFile" || action.type === "replaceFile") after = action.content;
  else if (action.type === "replaceSymbol") {
    if (action.sourceHash && action.sourceHash !== sourceHash(value)) throw new Error(`Le fichier ${action.path} a changé depuis l’analyse du symbole; relis-le avant de remplacer ${action.symbol}.`);
    let range:{start:number;end:number}|undefined;
    if(/\.[cm]?[jt]sx?$/i.test(action.path)){
      await initializeSemantic();
      const snapshot=semanticSource(action.path,value),matches=snapshot.symbols.filter(symbol=>symbol.name===action.symbol);
      const target=matches.length===1?matches[0]:undefined;
      if(!snapshot.diagnostics.length&&target?.startOffset!==undefined&&target.endOffset!==undefined)range={start:target.startOffset,end:target.endOffset};
    }else{
      // The conservative fallback cannot distinguish nested names. Reject
      // duplicate declarations instead of replacing the first arbitrary hit.
      const escaped=action.symbol.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      if([...value.matchAll(new RegExp(`\\b(?:fn|func|class|struct|enum)\\s+${escaped}\\b`,"g"))].length===1)range=symbolRange(value,action.symbol);
    }
    if (!range) throw new Error(`Symbole ${action.symbol} introuvable, ambigu ou sans offsets sûrs dans ${action.path} #${sourceHash(value)}. Relis les lignes utiles avec readFileRange, puis utilise replaceRange avec l’empreinte courante; aucun symbole arbitraire sélectionné.`);
    after = value.slice(0, range.start) + action.content + value.slice(range.end);
  }
  else {
    if(action.type!=="patchFile"&&action.type!=="applyPatch")throw Error("Mutation non prise en charge.");
    const first = value.indexOf(action.oldText);
    if (first < 0) throw new PatchConflictError(action.path,0,sourceHash(value));
    let matches=1;for(let next=value.indexOf(action.oldText,first+action.oldText.length);next>=0;next=value.indexOf(action.oldText,next+action.oldText.length))matches++;
    if(matches!==1)throw new PatchConflictError(action.path,matches,sourceHash(value));
    after = value.slice(0, first) + action.newText + value.slice(first + action.oldText.length);
  }
  if (after.length > 512_000) throw new Error(`Le fichier ${action.path} dépasserait la limite de taille.`);
  if (after === before) staged.delete(action.path);
  else staged.set(action.path, { path: action.path, before, after, created: current?.created || action.type === "createFile" });
  return `${action.type === "createFile" ? "Création" : "Patch"} préparé pour ${action.path}; aucune écriture appliquée au projet.`;
}
