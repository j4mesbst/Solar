import type {AgentQuestion} from '../domain/types';

const opening='<solar-question>',closing='</solar-question>';
/** Structured presentation only. Options never grant access or execute code. */
export const conversationQuestionInstructions=`
Réponds par messages très courts, sans titre ni introduction longue : normalement un ou deux messages de 1 à 2 phrases, jamais plus de trois bulles, puis une carte de choix. Ne sépare jamais Salut ou Oui dans des messages isolés. Dès que tu demandes comment aider, quoi faire ou quelle prochaine étape choisir, présente un seul QCM de trois actions en rapport direct avec ta mission et ton utilité. Évite les questions ouvertes vagues en fin de réponse. Ne recopie pas les résultats détaillés déjà affichés dans une carte native. Ne produis jamais du JSON de widgets, de cartes e-mail ou de boutons : les cartes natives sont créées automatiquement à partir des outils réellement exécutés. Une idée par paragraphe. Pour un livrable long demandé, conserve les détails utiles. Après un résultat, propose souvent une prochaine étape concrète par choix multiples. Adapte les choix aux faits effectivement trouvés, à la demande et aux services disponibles ; jamais de menu générique répété. Évite de demander ce que l’utilisateur a déjà précisé. Ne produis pas de faux acquittement ou progression : seuls les événements réels du moteur sont montrés. Quand un choix de l'utilisateur est nécessaire, ou qu'une prochaine étape concrète est utile après un résultat, propose une seule question avec deux à quatre options adaptées à cette conversation (cinq au maximum). N'invente jamais un résultat, une connexion ni un travail effectué. Ne demande pas à l'utilisateur de confirmer une simple lecture déjà demandée. Une question factuelle satisfaite n'exige pas de choix supplémentaire. Si l’utilisateur demande un QCM ou des actions au choix, fournis obligatoirement une seule question avec trois actions concrètes adaptées à ses accès et au contexte, pas trois questions différentes ni une liste A/B/C en Markdown. Pour afficher les choix, ajoute à la fin exactement : <solar-question>{"title":"Question courte ?","options":[{"id":"a","label":"Action concrète","prompt":"Demande exacte de l'utilisateur si ce choix est sélectionné","description":"Précision facultative"}]}</solar-question>. Pas de Markdown autour de ce bloc. Les options sont des demandes, jamais des autorisations générales. N'inclus aucune donnée sensible inutile dans leurs libellés. L'utilisateur peut toujours répondre librement.`;

export function parseAgentQuestion(content:string):{text:string;question?:AgentQuestion}{
 content=content.replace(/```(?:json|xml)?\s*(?=<solar-question>)/gi,'').replace(/(<\/solar-question>)\s*```/gi,'$1');
 const start=content.indexOf(opening);if(start<0){
  // Keep a partially streamed presentation marker out of the visible reply.
  for(let n=opening.length-1;n>1;n--)if(content.endsWith(opening.slice(0,n)))return{text:content.slice(0,-n).trimEnd()};
  return{text:content};
 }
 let end=content.indexOf(closing,start);if(end<0){try{JSON.parse(content.slice(start+opening.length).trim());content+=closing;end=content.indexOf(closing,start);}catch{return{text:content.slice(0,start).trimEnd()};}}
 try{
  const raw=JSON.parse(content.slice(start+opening.length,end).replace(/,\s*([}\]])/g,'$1'));const value={...raw,title:raw.title??raw.question,options:raw.options??raw.choices};
  if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>300||!Array.isArray(value.options)||value.options.length<1||value.options.length>5)throw Error();
  const ids=new Set<string>();
  const options=value.options.map((o:unknown)=>{
   const source=(typeof o==='string'?{label:o,prompt:o}:o) as Record<string,unknown>;const x:Record<string,unknown>=source?{...source,id:source.id??String.fromCharCode(97+ids.size),label:source.label??source.text??source.title,prompt:source.prompt??source.label??source.text??source.title}:source;
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

export const requestsAgentQuestion=(request:string)=>/\bqcm\b|choix\s+multiple|(?:sous|en)\s+forme\s+(?:de\s+)?(?:choix|questionnaire)|(?:propose|suggère).{0,70}actions?.{0,35}(?:choix|choisir)/iu.test(request);
const plainLabel=(value:string)=>value.replace(/\*\*|__/g,'').replace(/^\s*\[[ x]\]\s*/,'').trim();
/** A presentation fallback for a requested QCM. Labels become requests, never grants. */
export function requestedAgentQuestion(content:string,request:string):{text:string;question?:AgentQuestion}{
 const parsed=parseAgentQuestion(content);if(parsed.question||!requestsAgentQuestion(request))return parsed;
 let value=content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1');
 if(value.startsWith('{')){
  try{const raw=JSON.parse(value),q=raw.question&&typeof raw.question==='object'?raw.question:raw;const options=q.options??q.choices;
   if(Array.isArray(options)&&options.length>=2&&options.length<=5){const normalized={title:q.title??(typeof q.question==='string'?q.question:undefined)??'Par quoi commence-t-on ?',options:options.map((o:any,i:number)=>typeof o==='string'?{id:String.fromCharCode(97+i),label:o,prompt:o}:{id:o.id??String.fromCharCode(97+i),label:o.label??o.text??o.title,prompt:o.prompt??o.label??o.text??o.title,...(o.description?{description:o.description}:{})})};return parseAgentQuestion((typeof raw.message==='string'?raw.message+'\n\n':'')+'<solar-question>'+JSON.stringify(normalized)+'</solar-question>');}
  }catch{ /* Plain text remains available if the model did not emit JSON. */ }
 }
 if(/```/.test(content))return parsed;
 const lines=content.split('\n'),collect=(pattern:RegExp)=>lines.flatMap((line,index)=>{const match=plainLabel(line).match(pattern);return match?[{index,label:plainLabel(match[1])}]:[];});
 // Numbered top-level choices win over nested lettered answers.
 const numbered=collect(/^\s*(?:[-*+]\s*)?\d+[.)]\s+(.+)$/),lettered=collect(/^\s*(?:[-*+]\s*)?(?:[A-Ea-e][.)]|\[[A-Ea-e]\])\s+(.+)$/),bullets=collect(/^\s*[-*+]\s+(.+)$/);
 const choices=numbered.length>=2?numbered:lettered.length>=2?lettered:bullets;
 if(choices.length<2||choices.length>5||choices.some(c=>!c.label||c.label.length>200))return parsed;
 const before=lines.slice(0,choices[0].index).join('\n').trim();const paragraphs=before.split(/\n\s*\n/),last=paragraphs.at(-1)??'';const title=last.endsWith('?')&&last.length<=300?plainLabel(paragraphs.pop()!):'Par quoi commence-t-on ?';
 const question={title,options:choices.map((c,i)=>({id:String.fromCharCode(97+i),label:c.label,prompt:c.label}))};
 return{text:paragraphs.join('\n\n').trim(),question};
}
/** Remove only an unsupported widget serialization, never real code or JSON requested as a deliverable. */
export function withoutWidgetMarkup(content:string,request:string){
 if(/\b(?:json|code|schéma|schema|programm|script)\b/iu.test(request))return content;
 return content.replace(/(?:```(?:json)?\s*)?(\[\s*\{[\s\S]*?\}\s*\])(?:\s*```)?/gi,(whole,payload)=>{try{const data=JSON.parse(payload);return Array.isArray(data)&&data.length&&data.every(v=>v&&typeof v==='object'&&/^(?:email|mail|event|widget|card|button)$/i.test(v.type??v.kind??''))?'':whole;}catch{return whole;}}).trim();
}
/** Streaming preview hides presentation syntax until the final bounded parser can validate it. */
export function liveAgentText(content:string,request:string){
 let text=parseAgentQuestion(content).text;
 if(requestsAgentQuestion(request)){
  if(/^\s*(?:```(?:json)?\s*)?[{[]/.test(text))return '';
  const start=text.search(/^\s*(?:\*\*)?(?:\d+[.)]|[A-Ea-e][.)]|\[[A-Ea-e]\]|[-*+]\s)\s*/m);
  if(start>=0)text=text.slice(0,start).trimEnd();
 }
 if(!/\b(?:json|code|schéma|schema|programm|script)\b/iu.test(request)){
  const start=text.search(/(?:```(?:json)?\s*)?\[\s*\{\s*"(?:type|kind)"\s*:\s*"(?:email|mail|event|widget|card|button)"/i);
  if(start>=0)text=text.slice(0,start).trimEnd();
 }
 return text;
}

const helpingQuestion=/(?:comment (?:puis.je|t’aider|vous aider)|(?:en quoi|que|qu’est.ce que|qu'est.ce que).{0,35}(?:aider|faire)|(?:tu veux|veux.tu|souhaites.tu|voulez.vous).{0,65}\?|par quoi|quelle.{0,20}(?:priorit|action|étape))/iu;
/** Only role facts influence these offered requests; no tool execution or grants. */
export function roleActionQuestion(role:string):AgentQuestion{
 const options=/agenda|calend|rendez.vous|journée|organisation/iu.test(role)?[
  ['Préparer ma journée','Consulte mon agenda et prépare un bref point sur ma journée, sans rien modifier.'],['Repérer mes disponibilités','Repère mes créneaux libres dans mon agenda cette semaine, sans créer de rendez-vous.'],['Organiser mes priorités','Aide-moi à organiser mes priorités. Demande-moi celles que je veux avancer.']
 ]:/mail|courriel|messag|boîte de réception/iu.test(role)?[
  ['Résumer mes e-mails récents','Consulte mes cinq derniers e-mails et résume ce qui mérite mon attention.'],['Repérer les réponses à préparer','Repère les demandes auxquelles répondre dans mes cinq derniers e-mails, sans rien envoyer.'],['Préparer un brouillon','Aide-moi à préparer un brouillon de réponse. Demande-moi quel message concerne cette réponse.']
 ]:/github|dépôt|ticket|linear|développ|code/iu.test(role)?[
  ['Faire le point sur un projet','Aide-moi à faire le point sur un projet. Demande-moi lequel si je ne l’ai pas précisé.'],['Repérer les points bloquants','Aide-moi à repérer les points bloquants dans mon projet, sans le modifier.'],['Préparer les prochaines étapes','Propose les prochaines étapes adaptées à mon projet à partir de notre conversation.']
 ]:/recherch|document|rédig/iu.test(role)?[
  ['Résumer un document','Aide-moi à résumer un document. Demande-moi de préciser ou joindre le document.'],['Approfondir un sujet','Aide-moi à approfondir un sujet. Demande-moi lequel.'],['Préparer une rédaction','Aide-moi à préparer une rédaction. Demande-moi le sujet et le destinataire si nécessaire.']
 ]:[['Avancer sur ma priorité','Aide-moi à avancer sur ma priorité dans le cadre de ton rôle. Demande-moi mon objectif actuel.'],['Faire le point','Fais un point court sur ce qui reste à avancer dans notre conversation.'],['Préparer la prochaine étape','Propose une prochaine étape utile en rapport avec ton rôle et notre conversation.']];
 return{title:'Que veux-tu que je fasse pour toi ?',options:options.map(([label,prompt],i)=>({id:String.fromCharCode(97+i),label,prompt}))};
}
export function cleanAgentProse(content:string,request=''){
 if(/\b(?:code|json|script|commande|api|outil|tool)\b/iu.test(request))return content;
 return content.replace(/<(read[_ ]calendar|list[_ ]events|read[_ ]message|search[_ ]messages|latest[_ ]messages)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi,'').replace(/<(?:tool_call|function_call|function=[^>]+)>[\s\S]*?(?:<\/(?:tool_call|function_call|function)>|$)/gi,'').replace(/^\s*(?:`)?(?:(?:gmail|google[-_]calendar|calendar|github)\.)?(?:read[_ ]calendar|list[_ ]events|read[_ ]message|search[_ ]messages|latest[_ ]messages)(?:`)?(?:\([^\n]*\)|\s*\{[^\n]*\})?\s*[.。]?\s*$/gim,'').trim();
}
export function finalAgentPresentation(content:string,request:string,role:string){
 const clean=cleanAgentProse(withoutWidgetMarkup(content,request),request);
 let parsed=requestedAgentQuestion(clean,request);
 // A spontaneous choice list is treated like an explicit QCM when its own
 // introduction asks the user to choose. Ordinary factual lists stay prose.
 if(!parsed.question&&helpingQuestion.test(clean))parsed=requestedAgentQuestion(clean,request+' QCM');
 if(!parsed.question&&(requestsAgentQuestion(request)||helpingQuestion.test(clean))){
  const question=roleActionQuestion(role);
  const text=parsed.text.replace(/(?:^|(?<=[.!?])\s+|\n+)(?:Comment (?:puis.je|t’aider|vous aider)|En quoi|Que (?:veux.tu|puis.je)|Qu’est.ce que|Qu'est.ce que|(?:Tu veux|Veux.tu|Souhaites.tu|Voulez.vous)|Par quoi)[^?]*\?\s*$/iu,'').trim();
  return{text,question};
 }
 return parsed;
}
