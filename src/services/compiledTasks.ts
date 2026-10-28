import type {CortexPluginTool} from '../lib/cortex/tool-runtime.ts';
import {compileWorkflow,type CompiledWorkflow} from '../lib/cortex/workflow.ts';
/** Narrow, explicit intents only. Unknown/ambiguous requests stay in Cortex's
 * adaptive loop; a shortcut cannot silently drop extra requested operations. */
export function compileKnownTask(prompt:string,services:string[],tools:CortexPluginTool[]):CompiledWorkflow|undefined{
 if(services.length!==1)return;
 // A polite greeting before an explicit request must not disable a known read.
 // Only remove the delimited salutation, keeping every task and restriction.
 // The original message is still passed to Cortex and the answer model.
 prompt=prompt.replace(/^\s*(?:salut|bonjour|bonsoir|coucou|hello|hey|hi)[,!.]\s+/iu,'');
 // These rules select reads, never synthesize answers. All follow-up tools stay
 // available to the model, including pagination, threads and partial bodies.
 if(services[0]==="slack"&&!/\b(?:ne|pas|sans|not|don't|si|if)\b|envoi|publie|supprim/i.test(prompt)){
  const query=prompt.match(/^(?:cherche|recherche|search(?: for)?)\s+(.{1,200}?)\s+(?:dans|sur|in|on)\s+Slack(?:[.!?]|$)/i)?.[1]?.trim().replace(/^[«"“]|[»"”]$/g,"");
  if(query){try{return compileWorkflow({version:1,nodes:[{id:'search',tool:'slack.search_messages',arguments:{query}}]},tools);}catch{return;}}
 }
 if(services[0]==="linear"&&/^(?:liste|montre|list|show)\s+(?:mes|my)\s+(?:tickets|issues)\s+Linear\b/i.test(prompt)&&!/\b(?:ne|pas|sans|not|don't|si|if)\b|envoi|modifi|supprim|crée/i.test(prompt)){
  try{return compileWorkflow({version:1,nodes:[{id:'assigned',tool:'linear.list_issues',arguments:{}}]},tools);}catch{return;}
 }
 const positive=prompt.replace(/n['’]a pas été mis[e]? à jour/gi,'mis à jour');
 if(/\b(?:ne|pas|sans|ignore|not|don.t)\b/i.test(positive))return;
 if(services[0]!=="github"||/cré[eé]|modifi|supprim|envoi|publie|push le|crée|analyse.*code|readme|fichier|issue|pull request|ne (?:lis|consulte|vérifie|verifie).*pas.*(?:profil|activité)|sans (?:consulter|lire|vérifier).*(?:profil|activité)/i.test(prompt))return;
 const repository=prompt.match(/\b([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\b/)?.[1];
 if(!repository||!/mis[e]? à jour|dernier.*(?:commit|push)|activité|last.*(?:update|commit|push)|depuis quand/i.test(prompt))return;
 if(/depuis le|entre le|période|en 20\d\d|last month|mois dernier/i.test(prompt))return;
 const value={version:1,nodes:[{id:'activity',tool:'github.repository_activity',arguments:{repository}},...(/contribut|mon profil|my profile/i.test(prompt)?[{id:'profile',tool:'github.profile_activity',arguments:{}}]:[])]};
 try{return compileWorkflow(value,tools);}catch{return;}
}
