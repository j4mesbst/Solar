import { compactPromptFiles } from './prompt.ts';
import { fitContextPacket, type ContextPacket } from './context-engine.ts';
export const CHARACTERS_PER_TOKEN=2.3;
export function estimateTokens(text:string){return Math.ceil(text.length/CHARACTERS_PER_TOKEN);}
export const outputAllowance=(window:number,requested=2200,visual=false)=>Math.min(requested,Math.floor(window*(visual ? .5 : .3)));
export function sourceSelectionBudget(window:number){return Math.max(0,Math.floor((window-900-1400-outputAllowance(window))*CHARACTERS_PER_TOKEN));}
/** Conservative estimate of the serialized textual payload, not tokenizer
 * telemetry. Images have a separate explicit reserve; never count base64 as text. */
export function fitModelPayload(input:{prompt:string;system:string;schema?:object;tools?:unknown[];images?:number;contextWindow:number;outputTokens:number;context?:ContextPacket;maximumCharacters?:number}){
  const overhead=JSON.stringify({messages:[{role:'system',content:input.system},{role:'user',content:''}],format:input.schema,tools:input.tools});
  const reserve=900+(input.images??0)*1024+input.outputTokens;
  const chars=Math.min(input.maximumCharacters??Infinity,Math.floor((input.contextWindow-reserve)*CHARACTERS_PER_TOKEN)-overhead.length);
  if(chars<=0)throw Error('CORTEX_CONTEXT: Les instructions, le contrat et les réserves occupent la fenêtre. Aucune exigence utilisateur n’a été tronquée.');
  const measure=(value:string)=>JSON.stringify(value).length-2;
  const projection=input.context?fitContextPacket(input.context,chars,measure):undefined;
  let prompt=projection?.prompt??input.prompt;
  if(!projection){let limit=chars;prompt=compactPromptFiles(input.prompt,limit);for(let turn=0;measure(prompt)>chars&&turn<4;turn++){limit-=measure(prompt)-chars;prompt=compactPromptFiles(input.prompt,Math.max(0,limit));}if(measure(prompt)>chars)throw Error('CORTEX_CONTEXT: Payload sérialisé trop grand; exigences conservées.');}
  return {prompt,estimatedInputTokens:estimateTokens(overhead)+estimateTokens(JSON.stringify(prompt)),reserveTokens:reserve,serializedCharacters:overhead.length+measure(prompt),utf8Bytes:new TextEncoder().encode(overhead).length+new TextEncoder().encode(JSON.stringify(prompt)).length-2,selection:projection?.selection};
}
