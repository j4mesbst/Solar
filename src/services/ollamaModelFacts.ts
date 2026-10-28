import { invoke } from "@tauri-apps/api/core";
import { isNativeSolar } from "./ollamaNative.ts";
import { providerFetch, ollamaUrl } from "./transport.ts";
import { abortable } from "../lib/cortex/reliability.ts";
export interface OllamaModelInfo {capabilities?:string[];model_info?:Record<string,unknown>;parameters?:string;template?:string;modified_at?:string;details?:{quantization_level?:string;parameter_size?:string};license?:string}
export async function readOllamaModelInfo(baseUrl:string,model:string,signal:AbortSignal):Promise<OllamaModelInfo>{
 signal.throwIfAborted();
 if(isNativeSolar())return abortable(invoke<OllamaModelInfo>("ollama_model_info",{baseUrl,model}),signal);
 const response=await providerFetch(ollamaUrl(baseUrl,"/api/show"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model}),signal});
 if(!response.ok)throw Error(`Inspection Ollama indisponible (HTTP ${response.status}).`);
 return response.json();
}
export function modelFacts(info:OllamaModelInfo){
 const context=Object.entries(info.model_info??{}).filter(([key])=>key.endsWith(".context_length")).map(([,value])=>Number(value)).find(value=>Number.isSafeInteger(value)&&value>=1024);
 const capabilities=info.capabilities?.filter(value=>typeof value==="string").map(value=>value==="thinking"?"reasoning":value);
 return {contextWindow:context,capabilities};
}
