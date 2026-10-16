import type { AgentAction, AgentFileChange, AgentProject } from "./types.ts";
import { safeProjectPath } from "./actions.ts";
import { findSymbols, semanticSource, sourceHash } from "../cortex/semantic.ts";

export const atomicMutationTypes = ["replaceRange", "patchStyle", "applyPatch"];
export function validateAtomic(action:AgentAction):string|null|undefined {
  if(action.type==="searchSymbol")return action.query.length>=2&&action.query.length<=120?null:"Recherche de symbole hors limites.";
  if(action.type==="readSymbol")return /^(.+):(\d+)-(\d+)#([a-f0-9]+)$/.test(action.symbolId)&&safeProjectPath(action.symbolId.split(":")[0])?null:"Identifiant de symbole invalide.";
  if(action.type==="readFileRange"||action.type==="replaceRange") {
    if(!Number.isInteger(action.start)||!Number.isInteger(action.end)||action.start<1||action.end<action.start||action.end-action.start>199)return "Plage de lignes invalide (200 lignes maximum).";
    if(action.type==="replaceRange"&&(!action.sourceHash||action.content.length>60_000))return "Remplacement sans empreinte ou trop volumineux.";
  }
  if(action.type==="patchStyle") {
    if(!action.sourceHash||action.selector.length>160||/[{}<>@]/.test(action.selector))return "Sélecteur CSS invalide.";
    const entries=Object.entries(action.changes);if(!entries.length||entries.length>16||entries.some(([key,value])=>!/^--?[\w-]+$|^[a-z][a-z-]*$/.test(key)||typeof value!=="string"||value.length>160||/[{}<>;]|url\s*\(|expression\s*\(/i.test(value)))return "Propriétés CSS hors limites.";
  }
}
export async function atomicStage(action:AgentAction,project:AgentProject,staged:Map<string,AgentFileChange>,signal:AbortSignal):Promise<string|undefined>{
  if(action.type==="searchSymbol")return JSON.stringify(await findSymbols(action.query,project,[...staged.values()],signal));
  if(action.type==="readSymbol"){
    const match=action.symbolId.match(/^(.+):(\d+)-(\d+)#([a-f0-9]+)$/)!;const path=match[1];
    if(!safeProjectPath(path)||!project.files.includes(path)&&!staged.has(path))throw Error("Symbole hors index.");
    const source=staged.get(path)?.after??await project.readFile(path,signal);
    if(sourceHash(source)!==match[4])throw Error("Symbole obsolète : relance searchSymbol.");
    const symbol=semanticSource(path,source).symbols.find(item=>item.id===action.symbolId);if(!symbol)throw Error("Symbole non confirmé par le parseur.");
    return source.split("\n").slice(symbol.start-1,symbol.end).join("\n").slice(0,24_000);
  }
  if(action.type!=="readFileRange"&&action.type!=="replaceRange"&&action.type!=="patchStyle")return;
  const original=staged.get(action.path);const source=original?.after??await project.readFile(action.path,signal);const lines=source.split("\n");
  if(action.type==="readFileRange"){
    if(action.start>lines.length)throw Error(`Plage hors fichier : ${action.path} possède ${lines.length} lignes; aucune information nouvelle lue.`);
    const selected=lines.slice(action.start-1,action.end).map((line,i)=>`${action.start+i}: ${line}`).join('\n');
    return `${action.path} #${sourceHash(source)} (${lines.length} lignes)\n${selected.length>24_000?selected.slice(0,23_900)+'\n[Suite omise; demander une plage plus courte.]':selected}`;
  }
  if(sourceHash(source)!==action.sourceHash)throw Error(`${action.path} a changé : relis la plage avant le patch.`);
  let after:string;
  if(action.type==="replaceRange"){
    if(action.end>lines.length)throw Error("Plage hors fichier.");
    after=[...lines.slice(0,action.start-1),action.content,...lines.slice(action.end)].join("\n");
  }else{
    const escaped=action.selector.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const pattern=new RegExp(`(^|[}>\\n])([ \\t]*${escaped}\\s*\\{)([^{}]*)(\\})`,"gm");
    const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error("Règle CSS absente ou ambiguë : utilise un patch avec contexte.");
    after=source.replace(pattern,(_all,lead,head,body,tail)=>{
      let next=body;for(const [key,value] of Object.entries(action.changes)){const property=new RegExp(`(^|;)\\s*${key.replaceAll("-","\\-")}\\s*:[^;]*;?`,"g");next=next.replace(property,"$1");next+=`\n  ${key}: ${value};`;}return lead+head+next+"\n"+tail;
    });
  }
  const before=original?.before??source;if(after===before)staged.delete(action.path);else staged.set(action.path,{path:action.path,before,after,created:original?.created});
  return `Patch atomique préparé pour ${action.path}; source #${sourceHash(after)}.`;
}
