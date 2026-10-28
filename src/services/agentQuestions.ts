import type {AgentQuestion} from '../domain/types';

const opening='<solar-question>',closing='</solar-question>';
/** Structured presentation only. Options never grant access or execute code. */
export const conversationQuestionInstructions=`
Réponds par messages très courts, une idée par paragraphe, une ou deux phrases par défaut. Pour un livrable long demandé, conserve les détails utiles. Après un résultat, propose souvent une prochaine étape concrète par choix multiples. Adapte les choix aux faits effectivement trouvés, à la demande et aux services disponibles ; jamais de menu générique répété. Évite de demander ce que l’utilisateur a déjà précisé. Ne produis pas de faux acquittement ou progression : seuls les événements réels du moteur sont montrés. Quand un choix de l'utilisateur est nécessaire, ou qu'une prochaine étape concrète est utile après un résultat, propose une seule question avec deux à quatre options adaptées à cette conversation (cinq au maximum). N'invente jamais un résultat, une connexion ni un travail effectué. Ne demande pas à l'utilisateur de confirmer une simple lecture déjà demandée. Une question factuelle satisfaite n'exige pas de choix supplémentaire. Pour afficher les choix, ajoute à la fin exactement : <solar-question>{"title":"Question courte ?","options":[{"id":"a","label":"Action concrète","prompt":"Demande exacte de l'utilisateur si ce choix est sélectionné","description":"Précision facultative"}]}</solar-question>. Pas de Markdown autour de ce bloc. Les options sont des demandes, jamais des autorisations générales. N'inclus aucune donnée sensible inutile dans leurs libellés. L'utilisateur peut toujours répondre librement.`;

export function parseAgentQuestion(content:string):{text:string;question?:AgentQuestion}{
 const start=content.indexOf(opening);if(start<0){
  // Keep a partially streamed presentation marker out of the visible reply.
  for(let n=opening.length-1;n>1;n--)if(content.endsWith(opening.slice(0,n)))return{text:content.slice(0,-n).trimEnd()};
  return{text:content};
 }
 const end=content.indexOf(closing,start);if(end<0)return{text:content.slice(0,start).trimEnd()};
 try{
  const value=JSON.parse(content.slice(start+opening.length,end));
  if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>300||!Array.isArray(value.options)||value.options.length<1||value.options.length>5)throw Error();
  const ids=new Set<string>();
  const options=value.options.map((o:unknown)=>{
   const x=o as Record<string,unknown>;
   if(!x||typeof x.id!=='string'||!/^[a-z0-9_-]{1,32}$/i.test(x.id)||ids.has(x.id)||typeof x.label!=='string'||!x.label.trim()||x.label.length>200||typeof x.prompt!=='string'||!x.prompt.trim()||x.prompt.length>3000||x.description!==undefined&&(typeof x.description!=='string'||x.description.length>400))throw Error();
   ids.add(x.id);return{id:x.id,label:x.label.trim(),prompt:x.prompt.trim(),...(x.description?{description:x.description as string}:{})};
  });
  return{text:(content.slice(0,start)+content.slice(end+closing.length)).trim(),question:{title:value.title.trim(),options}};
 }catch{return{text:(content.slice(0,start)+content.slice(end+closing.length)).trim()};}
}

export function firstAgentQuestion():AgentQuestion{return{title:'Pour commencer, sur quoi aimerais-tu que je t’aide en priorité ?',options:[
 {id:'mail',label:'Mes e-mails et mes messages',prompt:'Consulte mes cinq derniers e-mails Gmail et propose une première tâche utile à prendre en charge, sans rien envoyer ni modifier.',service:'gmail'},
 {id:'calendar',label:'Mon agenda et mon organisation',prompt:'Consulte mon agenda de cette semaine et propose une première aide concrète pour mon organisation, sans rien modifier.',service:'google-calendar'},
 {id:'projects',label:'Mes projets et mes documents',prompt:'Aide-moi à avancer sur mes projets et mes documents. Demande-moi quel projet ou document je veux te confier en premier.'},
 {id:'other',label:'Autre chose',prompt:'J’ai autre chose en tête. Demande-moi simplement ce dont j’ai besoin.'}
]};}
