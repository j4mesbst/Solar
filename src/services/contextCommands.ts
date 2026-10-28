import type { Message, Model, Provider, Effort } from "../domain/types.ts";
import { conversationContextReport, prepareConversationContext } from "./conversationContext.ts";
export function contextCommand(text:string,attachmentCount=0):"context"|"memory"|undefined {return attachmentCount===0&&text.trim()==="/context"?"context":attachmentCount===0&&text.trim()==="/memory"?"memory":undefined;}
export async function runContextCommand(command:"context"|"memory",input:{conversationId:string;temporary?:boolean;messages:Message[];model:Model;provider:Provider;effort:Effort;signal:AbortSignal;onCompacting?:(active:boolean)=>void}){
 if(command==="context"){const report=await conversationContextReport(input);return {report,content:`Contexte : ${Math.round(report.input).toLocaleString("fr-FR")} / ${report.window.toLocaleString("fr-FR")} tokens estimés (${report.percent.toFixed(1)} %).`};}
 const prepared=await prepareConversationContext({...input,force:true});
 return {report:prepared.report,content:prepared.compacted?"Contexte compacté. La note de continuité sera utilisée pour les prochains échanges ; l’historique complet reste conservé.":"Aucun échange à compacter pour le moment."};
}
