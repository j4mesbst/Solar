import { isNativeSolar } from "./ollamaNative.ts";
import type { AgentFileChange, AgentProject } from "../lib/agent/types.ts";
import type { CortexVerification, RenderReport, InspectionOptions } from "../lib/cortex/types.ts";
import { trajectoryFromTask, retrieveTrajectories } from "../lib/cortex/learning.ts";
import { cortexStore } from "./cortexStore.ts";
import { providerFetch, ollamaUrl } from "./transport.ts";
import { sourceHash } from "../lib/cortex/semantic.ts";
import { safeProjectPath } from "../lib/agent/actions.ts";

const semanticCache=new Map<string,CortexVerification[]>();
export async function cortexSemantic(token:string,paths:string[],changes:AgentFileChange[],signal:AbortSignal):Promise<CortexVerification[]>{
  if(!isNativeSolar()||!paths.some(path=>path.endsWith(".swift")))return [];
  const key=token+changes.map(change=>`${change.path}:${sourceHash(change.after)}`).join(";");const cached=semanticCache.get(key);if(cached)return cached;
  const {invoke}=await import("@tauri-apps/api/core");const requestId=crypto.randomUUID();const abort=()=>{void invoke("cortex_cancel",{requestId});};signal.throwIfAborted();signal.addEventListener("abort",abort,{once:true});
  try{
    const checks=await abortableInvoke(invoke<CortexVerification[]>("cortex_semantic",{token,changes,requestId}),signal);
    const result=checks.map(check=>({...check,hardConstraint:false,validatorId:"sourcekit-navigation",validatorVersion:"1"}));
    semanticCache.set(key,result);while(semanticCache.size>40)semanticCache.delete(semanticCache.keys().next().value!);return result;
  }catch(error){signal.throwIfAborted();return [{type:"structure",status:"unavailable",success:false,hardConstraint:false,validatorId:"sourcekit-navigation",output:error instanceof Error?error.message:String(error)}];}
  finally{signal.removeEventListener("abort",abort);}
}

export async function cortexCheck(token: string, changes: AgentFileChange[], signal: AbortSignal, taskId: string, capture=false, temporal=false, reference?:string, options?:InspectionOptions): Promise<CortexVerification[]> {
  if (!isNativeSolar()) return [{ type: "build", success: false, status: "unavailable", output: "La compilation de projet nécessite Solar pour macOS." }];
  const { invoke } = await import("@tauri-apps/api/core"); const requestId = crypto.randomUUID();
  const abort = () => { void invoke("cortex_cancel", { requestId }); }; signal.throwIfAborted(); signal.addEventListener("abort",abort,{once:true});
  try { return await abortableInvoke(invoke("cortex_check", { token, changes, requestId, taskId, capture: capture||Boolean(options), temporal: temporal||Boolean(options?.timeline), reference, options }),signal); } finally { signal.removeEventListener("abort",abort); }
}
export async function cortexRender(html: string, times: number[], signal: AbortSignal, reference?: string, options?:InspectionOptions): Promise<RenderReport> {
  if (!isNativeSolar()) return { supported: false, frames: [], errors: ["Capture native indisponible dans l’aperçu web."], width: 1280, height: 800 };
  const { invoke } = await import("@tauri-apps/api/core"); const requestId = crypto.randomUUID();
  const abort = () => { void invoke("cortex_cancel", { requestId }); }; signal.throwIfAborted(); signal.addEventListener("abort",abort,{once:true});
  try { return await abortableInvoke(invoke("cortex_render", { html, times, requestId, reference, options }),signal); } finally { signal.removeEventListener("abort",abort); }
}
function abortableInvoke<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException("Annulé","AbortError"));if(signal.aborted){operation.catch(()=>{});abort();return;}signal.addEventListener("abort",abort,{once:true});operation.then(resolve,reject).finally(()=>signal.removeEventListener("abort",abort));});
}
export async function inspectModelCapabilities(baseUrl: string, model: string, signal: AbortSignal) {
  const response = await providerFetch(ollamaUrl(baseUrl, "/api/show"), { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({model}), signal });
  if (!response.ok) throw new Error(`Informations du modèle indisponibles (${response.status}). Mets Ollama à jour si nécessaire.`);
  const info = await response.json() as { capabilities?: string[]; template?: string; modified_at?:string; parameters?:string; model_info?:Record<string,unknown>; details?: { quantization_level?: string; parameter_size?:string }; license?: string };
  const capabilities = info.capabilities ?? [];
  const contextLength=Object.entries(info.model_info??{}).find(([key,value])=>key.endsWith('.context_length')&&typeof value==='number')?.[1] as number|undefined;
  let digest:string|undefined;
  try{
    const tags=await providerFetch(ollamaUrl(baseUrl,'/api/tags'),{signal});
    if(tags.ok){const data=await tags.json() as {models?:{name?:string;model?:string;digest?:string}[]};digest=data.models?.find(item=>item.name===model||item.model===model||item.name===`${model}:latest`)?.digest;}
  }catch(error){if(signal.aborted)throw error;}
  return { vision: capabilities.includes("vision"), tools: capabilities.includes("tools"), thinking: capabilities.includes("thinking"), templatePresent: Boolean(info.template), quantization: info.details?.quantization_level, license: info.license,contextLength,identity:sourceHash(JSON.stringify([digest,info.modified_at,info.parameters,info.model_info,info.template,info.details,capabilities])) };
}
export const cortexMemory = {
  retrieve: async (prompt: string, workspaceId: string,project?:AgentProject,signal?:AbortSignal,identity?:{modelKey:string;environment?:string}) => {
    if(!project||!signal)return '';
    const items=await cortexStore.trajectories(),sources:Record<string,string>={},shaSources:Record<string,string>={};
    const paths=[...new Set(items.filter(item=>item.workspaceId===workspaceId).slice(-15).flatMap(item=>Object.keys(item.sourceFingerprints??{})))].filter(path=>safeProjectPath(path)&&project.files.includes(path)).slice(0,40);
    for(const path of paths){signal.throwIfAborted();try{const content=await project.readFile(path,signal);sources[path]=sourceHash(content);if(globalThis.crypto?.subtle){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));shaSources[path]=[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}}catch(error){if(signal.aborted)throw error;}}
    return retrieveTrajectories(items,prompt,workspaceId,sources,shaSources,identity);
  },
  record: async (task: Parameters<typeof trajectoryFromTask>[0]) => { if (task.conversationId.startsWith("temp:")) return; const item=trajectoryFromTask(task); if(item) await cortexStore.record(item); },
};
