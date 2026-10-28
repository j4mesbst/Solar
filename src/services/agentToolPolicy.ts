import type { Effort } from "../domain/types.ts";
import type { CortexPluginTool, CortexToolRequirement } from "../lib/cortex/tool-runtime.ts";
export function toolBindings(tools:CortexPluginTool[]){
 // Request-local aliases: index guarantees uniqueness without repeating a long
 // service prefix and hash in every schema, call and observation. Persisted
 // calls continue to use canonical names, never these transient wire aliases.
 const names=new Map(tools.map((tool,index)=>[tool.name,`t${index}_${tool.name.split('.').at(-1)!.replace(/[^a-zA-Z0-9_]/g,"_").slice(0,48)}`]));
 return {names,reverse:new Map([...names].map(([real,wire])=>[wire,real])),functions:tools.map(tool=>({type:"function" as const,function:{name:names.get(tool.name)!,description:tool.description,parameters:tool.parameters}}))};
}
/** Scope a prohibition to its action verb, never to an unrelated negative fact. */
function negatedAction(prompt:string,verb:string){
 const pronoun="(?:(?:le|la|les|me|nous|vous|lui|en)\\s+|l[’']){0,2}";
 const tail="[^.!?;\\n]{0,80}\\b(?:pas|jamais|aucun|aucune|en aucun cas)\\b";
 return new RegExp(`(?:\\bne\\s+${pronoun}(?:pas|jamais)\\s+${verb}\\b)|(?:\\bne\\s+${pronoun}${verb}\\b${tail})|(?:\\bn[’']${verb}\\b${tail})|(?:\\bsans\\s+(?:jamais\\s+)?${verb}\\b)|(?:\\b(?:do not|don't|never)\\s+(?:ever\\s+)?${verb}\\b)|(?:\\bne\\s+(?:dois|peux|veux|souhaite)\\s+pas\\s+${verb}\\b)`,'iu').test(prompt);
}
export function negatesMutation(prompt:string){
 const verb="(?:cr[ée]e(?:r|z)?|ajout(?:e|er|ez)|modifi(?:e|er|ez)|renomm(?:e|er|ez)|déplac(?:e|er|ez)|archiv(?:e|er|ez)|enregistr(?:e|er|ez)|planifi(?:e|er|ez)|organis(?:e|er|ez)|mets|mettre|ouvr(?:e|ir|ez)|supprim(?:e|er|ez)|effac(?:e|er|ez)|retir(?:e|er|ez)|publi(?:e|er|ez)|update|create|add|edit|move|rename|execute|run|delete|remove)";
 if(/(?:^|[.!?;\n])\s*(?:ne (?:fais|faites) (?:(?:surtout|absolument) )?pas de|n[’']apporte aucune?|sans aucune?) (?:modification|création|suppression|édition)/iu.test(prompt)||/\bsans rien modifier/iu.test(prompt))return true;
 return negatedAction(prompt,verb);
}
export function negatesSend(prompt:string){return negatedAction(prompt,'(?:envoie|envoyer|envoyez|publi(?:e|er|ez)|poste|poster|postez|send|publish|post)');}
export function taskRequirements(prompt:string,services:string[],tools:CortexPluginTool[]):CortexToolRequirement[]{
 const requirements:CortexToolRequirement[]=services.map(service=>({id:service,service,description:`Obtenir des résultats réels de ${service}`}));
 const add=(id:string,description:string,names:string[])=>{const available=names.filter(name=>tools.some(tool=>tool.name===name));if(available.length)requirements.push({id,description,tools:available});};
 if(services.includes("github")){
  if(/contribut|mon profil|my profile|followers|abonnés/i.test(prompt))add("github-profile","Lire le profil et les contributions demandées",["github.profile_activity"]);
  if(/(?:repo|dépôt|repository)/i.test(prompt)&&/mis[e]? à jour|dernier.*(?:commit|push)|activité|last.*(?:update|commit|push)|depuis quand/i.test(prompt))add("github-activity","Vérifier la dernière activité du dépôt",["github.repository_activity","github.list_commits"]);
 }
 for(const service of ["gmail","outlook"].filter(service=>services.includes(service)))if(/analys|résum|summari|contenu|lire|lis\b/i.test(prompt))add(`${service}-content`,"Lire le contenu des e-mails avant de les analyser",service==="gmail"?["gmail.read","gmail.read_message","gmail.latest_messages"]:["outlook.read_message","outlook.read_message_part","outlook.latest_messages"]);
  for(const service of ["gmail","outlook"].filter(service=>services.includes(service)))if(/brouillon|draft|relance/i.test(prompt)&&/pr[ée]pare|r[ée]dige|cr[ée]e|enregistre|create|write/i.test(prompt)&&!negatesMutation(prompt))add(`${service}-draft`,"Enregistrer et vérifier le brouillon sans envoi",[`${service}.create_draft`]);
 const needed=(id:string,tool:string,description:string,minCount=1)=>{if(!requirements.some(r=>r.id===id))requirements.push({id,tools:[tool],description,minCount});};
 for(const service of ['gmail','outlook','slack'].filter(s=>services.includes(s))){const tool=`${service}.send_message`;if(missionAllowsTool(prompt,{name:tool,description:'',parameters:{},risk:'publish',externalEffects:true}))needed(`${service}-send`,tool,'Effectuer l’envoi demandé et vérifier son résultat, ou demander une précision si non autorisé');}
 const count=prompt.match(/(?:crée|créer|ajoute|planifie|create|add)\s+(\d{1,2}|un|une|deux|trois|quatre|cinq|two|three)\s+(événements?|rendez-vous|issues?|tickets?|brouillons?|pull requests?)/i);
 if(count&&!negatesMutation(prompt)){
  const numbers:Record<string,number>={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,two:2,three:3},n=numbers[count[1].toLowerCase()]??Number(count[1]),noun=count[2].toLowerCase();
  const candidates=/événement|rendez-vous/.test(noun)?services.filter(s=>['google-calendar','ms-calendar'].includes(s)).map(s=>`${s}.create_event`):/brouillon/.test(noun)?services.filter(s=>['gmail','outlook'].includes(s)).map(s=>`${s}.create_draft`):/pull/.test(noun)?services.filter(s=>s==='github').map(s=>`${s}.create_pull_request`):services.filter(s=>['github','linear'].includes(s)).map(s=>`${s}.create_issue`);
  if(candidates.length===1&&n>=1&&n<=20)needed('requested-creations',candidates[0],`Créer et vérifier les ${n} élément(s) demandés ; ne pas conclure après une partie seulement`,n);
 }
 return requirements;
}
export const missionBudget=(effort:Effort)=>({low:12,medium:24,high:48,xhigh:72,ultra:100})[effort];
export const missionGuidance=(effort:Effort)=>effort==="low"?"Privilégie le chemin direct, sans appels redondants.":effort==="medium"?"Couvre chaque partie de la demande et vérifie les sources utiles.":"Décompose les demandes multiples, identifie les dépendances, recoupe les résultats utiles et vérifie quantités, dates, incertitudes et chaque partie de la demande avant de conclure. La vérification doit utiliser les résultats réels, jamais inventer une action.";

/** A full-access setting approves execution, not instructions hidden in fetched
 * content. Available mutating tools must still match the user's root request.
 * Draft-only wording must never expose a send tool. Ambiguity stays read-only. */
export function missionAllowsTool(prompt:string,tool:CortexPluginTool){
 if((tool.risk??'read')==='read'&&!tool.externalEffects&&!tool.permissions?.some(p=>/\.write$|execution/.test(p)))return true;
 const send=/\b(?:envoie|envoyez|publie|postez|poste|send|publish|post)\b|(?:peux.tu|pourrais.tu|merci de|veuillez|please)\s+(?:envoyer|publier|poster|send)/i.test(prompt)&&!negatesSend(prompt);
 if(tool.name==='github.create_issue'||tool.name==='github.create_pull_request')return /\b(?:crée|créer|ouvre|ouvrir|create|open|publie)\b/i.test(prompt)&&(tool.name.endsWith('pull_request')?/pull request|\bPR\b/i.test(prompt):/issue|ticket/i.test(prompt))&&!negatesMutation(prompt);
 if(/(?:^|\.)(?:send\w*|post_message|publish\w*)$/.test(tool.name)||tool.risk==='publish')return send;
 if(/\.create_draft$/.test(tool.name))return send||/brouillon|draft|relance/i.test(prompt)&&/pr[ée]pare|r[ée]dige|cr[ée]e|enregistre|create|write|draft a/i.test(prompt)&&!negatesMutation(prompt);
 if(tool.risk==='delete')return /supprime|supprimer|efface|effacer|delete|remove|retire|retirer/i.test(prompt)&&!negatesMutation(prompt);
 return /\b(?:crée|créer|cr[ée]ez|ajoute|ajouter|modifie|modifier|renomme|renommer|déplace|déplacer|archive|archiver|enregistre|enregistrer|planifie|planifier|organise|organiser|mets|mettre|update|create|add|edit|move|rename|execute|run)\b/i.test(prompt)&&!negatesMutation(prompt);
}
