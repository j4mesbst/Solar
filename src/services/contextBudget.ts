import type { Effort, Message, Model, Provider } from "../domain/types.ts";
import { modelWithProviderLimits } from "./providerCapabilities.ts";
import { runtimeProfile } from "./performance.ts";

export interface ContextReport {
 model: string; documentNotes?:number;source?:string;window: number; declared: boolean; input: number; outputReserve: number; available: number; percent: number;
 system: number; tools: number; summary: number; messages: number; attachments: number; turns: number;
 compactedMessages: number; compactions: number; measuredPrompt?: number; measuredOutput?: number;
}
export const textTokens=(value:string)=>Math.ceil(new TextEncoder().encode(value).length/3);
export function modelContext(model:Pick<Model,"contextWindow"|"providerModelId"|"id"> & Partial<Model>,provider:Pick<Provider,"protocol"> & Partial<Provider>,_profile?:Parameters<typeof runtimeProfile>[0]){
 model=modelWithProviderLimits(model as Model,{protocol:provider.protocol,baseUrl:provider.baseUrl??""});
 const declared=Number.isInteger(model.contextWindow)&&model.contextWindow!>=1024;
 // Never claim a model maximum from a name. Discovery metadata is authoritative;
 // a missing provider maximum is explicitly displayed as an estimate.
 const capacity=declared?model.contextWindow!:provider.protocol==="ollama"?32768:65536;
 return {window:capacity,declared,source:model.contextSource};
}
export const responseReserve=(effort:Effort)=>({low:2048,medium:8192,high:16384,xhigh:24576,ultra:32768})[effort];
export const contextMessages=(messages:Message[])=>messages.filter(m=>!m.localCommand&&m.role!=="system"&&m.status==="completed");
export function messageTokens(message:Message){return textTokens(message.content)+textTokens(message.toolReferences?.length?JSON.stringify(message.toolReferences):"")+12+(message.attachments?.filter(a=>a.kind==="image").length??0)*2048;}
export function measureContext(input:{model:Model;provider:Provider;messages:Message[];documentNotes?:number;system?:string;tools?:unknown[];summary?:string;effort?:Effort;profile?:Parameters<typeof runtimeProfile>[0];compactedMessages?:number;compactions?:number;measuredPrompt?:number;measuredOutput?:number;systemTokens?:number;toolTokens?:number}):ContextReport{
 const capacity=modelContext(input.model,input.provider,input.profile),messages=contextMessages(input.messages);
 const attachments=messages.reduce((n,m)=>n+(m.attachments?.filter(a=>a.kind==="image").length??0)*2048,0);
 const system=input.systemTokens??(textTokens(input.system??"")+32),tools=input.toolTokens??textTokens(input.tools?.length?JSON.stringify(input.tools):""),summary=textTokens(input.summary??"");
 const messageCost=messages.reduce((n,m)=>n+messageTokens(m),0)-attachments;
 const limits=modelWithProviderLimits(input.model,{protocol:input.provider.protocol,baseUrl:input.provider.baseUrl??""});
 const outputReserve=Math.min(responseReserve(input.effort??"medium"),Math.floor(capacity.window*.25),limits.maxOutputTokens??Infinity);
 const total=system+tools+summary+messageCost+attachments;
 return {model:input.model.displayName??input.model.name,documentNotes:input.documentNotes,window:capacity.window,declared:capacity.declared,source:capacity.source,input:total,outputReserve,available:Math.max(0,capacity.window-total-outputReserve),percent:Math.min(100,total/capacity.window*100),system,tools,summary,messages:messageCost,attachments,turns:messages.filter(m=>m.role==="user").length,compactedMessages:input.compactedMessages??0,compactions:input.compactions??0,measuredPrompt:input.measuredPrompt,measuredOutput:input.measuredOutput};
}

export function splitContextText(text:string,budget:number){
 const chunks:string[]=[];let offset=0;
 while(offset<text.length){let low=1,high=Math.min(text.length-offset,budget*3),size=0;
  while(low<=high){const mid=Math.floor((low+high)/2);if(textTokens(text.slice(offset,offset+mid))<=budget){size=mid;low=mid+1;}else high=mid-1;}
  if(!size)throw Error("Le fragment ne tient pas dans le contexte.");if(size>1&&/[\uD800-\uDBFF]/.test(text[offset+size-1]))size--;
  chunks.push(text.slice(offset,offset+size));offset+=size;
 }return chunks.length?chunks:[""];
}
