import type { Message, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";
import type { AgentModelCall } from "../lib/agent/types";
import type { CortexModelResponse } from "../lib/cortex/types";
import { streamChat } from "./chatApi.ts";
import type { Metrics } from "../domain/extensions.ts";
import { fitModelPayload,outputAllowance } from '../lib/cortex/budget.ts';
import { isVisualObjective } from "../lib/cortex/router.ts";

export function fitCortexPrompt(prompt: string, system: string, contextWindow: number, outputTokens: number) {
  return fitModelPayload({prompt,system,contextWindow,outputTokens}).prompt;
}
export function createCortexBackend(input: {provider:Provider;vault:SecretVault;conversationId:string;modelId:string;contextWindow:number;tools:boolean;vision:boolean;onVisible:(delta:string)=>void}) {
  // This backend belongs to one selected model/task. Once the transport
  // proves unreliable, keep the schema fallback for subsequent turns instead
  // of paying for the same broken tool request on every repair.
  let reliableTools=input.tools;
  return async(call:AgentModelCall,signal:AbortSignal):Promise<CortexModelResponse>=>{
    let text=""; let metrics:Metrics|undefined;
    const visualRequest = call.visual??isVisualObjective(call.prompt);
    // A complete autonomous visual fixture needs one coherent HTML/CSS file.
    // Reserve a little more room for that single response, rather than
    // repeatedly truncating JSON and paying several repair turns.
    const output=outputAllowance(input.contextWindow,call.maxOutputTokens,visualRequest);
    const actionsSchema=call.schema && "actions" in ((call.schema as {properties?:object}).properties??{});
    // Long HTML/CSS patches are much more reliable in Ollama's JSON-schema
    // response mode. Tool-call arguments are streamed separately and can be
    // cut halfway through a large visual artifact; ordinary code keeps the
    // native propose_actions tool for its compact patches.
    const tools=reliableTools&&!call.preferJson&&actionsSchema&&!visualRequest?[{type:"function",function:{name:"propose_actions",description:"Propose des actions de projet validées par Solar Cortex.",parameters:call.schema}}]:undefined;
    if(call.images?.length&&!input.vision)throw new Error("La vision n’est pas disponible pour ce backend.");
    const request = (useTools: boolean) => {
      const system=call.system+(!useTools&&toolFallbacks?'\nTransport outils incompatible : objet JSON complet du schéma, sans Markdown.':'');
      // CortexRuntime has already performed the authoritative fit. Re-fitting
      // its serialized packet together with call.context duplicates the whole
      // context in a second user message projection.
      let prompt:string;
      if(call.contextPrepared){
        prompt=call.prompt;
      }else{
        const fitted=fitModelPayload({prompt:call.prompt,context:call.context,system,schema:useTools?undefined:call.schema,tools:useTools?tools:undefined,images:call.images?.length,contextWindow:input.contextWindow,outputTokens:output});
        call.onContext?.(fitted);prompt=fitted.prompt;
      }
      const message:Message={id:crypto.randomUUID(),conversationId:input.conversationId,role:'user',content:prompt,status:'completed',createdAt:new Date().toISOString(),order:0,attachments:call.images?.slice(0,4).map((image,i)=>({id:String(i),title:`Capture Cortex ${i+1}`,kind:'image',content:image}))};
      return streamChat({provider:input.provider,model:input.modelId,messages:[message],effort:'low',exactSystem:true,systemInstruction:system,localOptions:{temperature:call.temperature??.6,numCtx:input.contextWindow,keepAlive:'5m'},maxOutputTokens:output,format:useTools?undefined:call.schema,tools:useTools?tools:undefined,vault:input.vault,signal,onProgress:call.onProgress,onMetrics:value=>{metrics=value;},onDelta:delta=>{text+=delta;call.onDelta?.(delta);if(call.visible)input.onVisible(delta);}});
    };
    let completion;
    let toolFallbacks=0;
    try {
      completion = await request(Boolean(tools));
    } catch (error) {
      // llama-server returns HTTP 500 when a streamed tool call ends midway
      // through its JSON arguments. Retrying the identical tool request only
      // repeats the failure; JSON-schema output is the compatible fallback.
      const detail = error instanceof Error ? error.message : String(error);
      if (!tools || !/invalid tool call arguments|unexpected end of JSON input/i.test(detail)) throw error;
      reliableTools=false;
      toolFallbacks++;
      text = "";
      completion = await request(false);
    }
    return{text,...completion,metrics,toolFallbacks};
  };
}
