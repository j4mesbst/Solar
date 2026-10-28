import { textTokens } from "./contextBudget.ts";

/** Allocate the KV cache for this request, not the model's entire advertised
 * maximum. No message, source or output budget is dropped to fit a small tier.
 * Large requests still expand to the configured maximum. Images retain the
 * full window because their encoder's token count is model-dependent. */
export function localRequestContext(maximum:number,messages:unknown[],tools:unknown,output:number){
 if(!Number.isSafeInteger(maximum)||maximum<1024)throw Error("Capacité de contexte locale invalide.");
 const hasImages=messages.some((m:any)=>m.images?.length||Array.isArray(m.content)&&m.content.some((p:any)=>p.type==='image_url'||p.type==='image'));
 if(hasImages)return maximum;
 const estimated=textTokens(JSON.stringify(messages))+textTokens(JSON.stringify(tools??[]));
 const required=estimated+Math.max(1,Math.ceil(output))+Math.max(1024,Math.ceil(estimated*.2));
 if(required>=maximum)return maximum; // Existing context preparation handles the real capacity.
 let tier=8192;
 while(tier<required)tier*=2;
 return Math.min(maximum,tier);
}
