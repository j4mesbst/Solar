import {incompleteToolResult} from './toolEvidence.ts';
import type {CortexToolCall} from '../lib/cortex/tool-runtime.ts';
const parsed=(call:CortexToolCall):any=>{try{return JSON.parse(call.result);}catch{return undefined;}};
const months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dates(text:string){const result:string[]=[];for(const match of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g))result.push(`${match[1]}-${match[2]}-${match[3]}`);for(const match of text.matchAll(/\b(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(20\d{2})\b/gi))result.push(`${match[3]}-${String(months.indexOf(match[2].toLowerCase())+1).padStart(2,'0')}-${match[1].padStart(2,'0')}`);return result;}
/** Cheap checks of structured, freshly returned facts. Never a second LLM judge.
 * Absence of a detectable contradiction is not a universal semantic guarantee. */
export function answerContradictions(prompt:string,answer:string,calls:CortexToolCall[]){
 const issues:string[]=[];
 const weekday=new Intl.DateTimeFormat('fr-FR',{weekday:'long'}).format(new Date());
 const claimedToday=answer.match(/aujourd[’']hui\s+(?:étant|est|nous sommes)\s+(?:(?:un|le)\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i)?.[1]?.toLocaleLowerCase();
 if(claimedToday&&claimedToday!==weekday)issues.push(`Le jour actuel est ${weekday} ; corrige le jour annoncé et ne déduis aucune échéance depuis un mauvais jour.`);

 const knownDates=calls.flatMap(call=>[...call.result.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})(?=T|[^0-9]|$)/g)].map(m=>m[0]));
 for(const claim of answer.matchAll(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})[ .]+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv\.?|févr\.?|avr\.?|juil\.?|sept\.?|oct\.?|nov\.?|déc\.?)(?:\s+(20\d{2}))?/gi)){
  const index=months.findIndex(m=>m.startsWith(claim[3].replace(/\.$/,'').toLocaleLowerCase())),day=Number(claim[2]);
  const source=knownDates.find(d=>Number(d.slice(5,7))===index+1&&Number(d.slice(8,10))===day);
  if(!source&&!claim[4])continue;
  const year=Number(claim[4]??source?.slice(0,4)),date=new Date(Date.UTC(year,index,day));
  const expected=new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(date);
  if(expected!==claim[1].toLocaleLowerCase())issues.push(`Le ${day}/${index+1}/${year} est un ${expected}, pas un ${claim[1]}. Ne transforme pas une échéance « vendredi » en date du rendez-vous.`);
 }
 for(const claim of answer.matchAll(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(?:le\s+)?(\d{1,2})[\/.](\d{1,2})(?:[\/.](20\d{2}))?/gi)){
  const day=Number(claim[2]),month=Number(claim[3]),source=knownDates.find(d=>Number(d.slice(5,7))===month&&Number(d.slice(8,10))===day);
  if(!source&&!claim[4])continue;const year=Number(claim[4]??source?.slice(0,4)),expected=new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,day)));
  if(expected!==claim[1].toLocaleLowerCase())issues.push(`Le ${day}/${month}/${year} est un ${expected}, pas un ${claim[1]}. Corrige la date dans la synthèse.`);
 }
 for(const claim of answer.matchAll(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(?:le\s+)?(20\d{2})-(\d{2})-(\d{2})\b/gi)){
  const date=new Date(Date.UTC(Number(claim[2]),Number(claim[3])-1,Number(claim[4]))),expected=new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(date);
  if(expected!==claim[1].toLocaleLowerCase())issues.push(`Le ${claim[2]}-${claim[3]}-${claim[4]} est un ${expected}, pas un ${claim[1]}. Corrige la synthèse.`);
 }
 // Compare an explicitly named calendar event to its own date, not merely to a valid weekday.
 const events:{title:string;date:string}[]=[];
 const visit=(value:unknown,depth=0)=>{if(depth>10||!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(v=>visit(v,depth+1));return;}const object=value as Record<string,any>,start=typeof object.start==='string'?object.start:object.start?.dateTime??object.start?.date;const title=object.title??object.summary;if(typeof start==='string'&&/^20\d{2}-\d{2}-\d{2}/.test(start)&&typeof title==='string')events.push({title,date:start.slice(0,10)});Object.values(object).forEach(v=>visit(v,depth+1));};
 for(const call of calls)if(call.completed)visit(parsed(call));
 for(const item of events)for(const line of answer.split('\n').filter(l=>l.toLocaleLowerCase().includes(item.title.toLocaleLowerCase()))){
  const claims=dates(line);
  // Dotted hours (10.30) are not dates. Dotted dates require a year;
  // slash dates may inherit the source year. Ambiguous multi-date lines
  // containing the actual event date are left to more specific validators.
  for(const match of line.matchAll(/\b(\d{1,2})([\/.])(\d{1,2})(?:\2(20\d{2}))?\b/g)){
   if(match[2]==='.'&&!match[4])continue;const day=Number(match[1]),month=Number(match[3]);if(day<1||day>31||month<1||month>12)continue;
   claims.push(`${match[4]??item.date.slice(0,4)}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
  }
  if(claims.length&&!claims.includes(item.date))issues.push(`Le rendez-vous « ${item.title} » est daté ${item.date} dans la source, corrige la date indiquée sur sa ligne.`);
 }
 for(const call of calls){if(!call.completed||call.externalEffects)continue;const data=parsed(call);if(!data||data.partial)continue;
  if(call.tool==='github.profile_activity'&&/contribut/i.test(prompt)){
   const actual=data.contributions?.contributionCalendar?.totalContributions;
   const claims=[...answer.matchAll(/\b(\d[\d\u00a0\u202f ]*)\s+contributions?\b/gi)].map(m=>Number(m[1].replace(/\s/g,'')));
   if(claims.some(n=>typeof actual!=='number'||n!==actual))issues.push(typeof actual==='number'?`GitHub a renvoyé exactement ${actual} contributions ; corrige le nombre annoncé.`:'GitHub n’a pas fourni de nombre de contributions ; signale cette indisponibilité.');
  }
  if(call.tool==='github.repository_activity'&&typeof data.lastPushAt==='string'&&/mis[e]? à jour|push|commit|activité|depuis quand/i.test(prompt)){
   const firstPart=answer.split(/profil|contributions?/i)[0],claims=dates(firstPart),actual=data.lastPushAt.slice(0,10);
   if(claims.length&&!claims.includes(actual))issues.push(`Le dernier push vérifié est ${actual}. La date annoncée ne correspond pas à la source.`);
  }
 }
 return [...new Set(issues)];
}
export function missionProof(calls:CortexToolCall[]){
 let checked=0;const limitations:string[]=[];
 for(const call of calls){if(!call.completed){limitations.push(`Résultat non confirmé : ${call.tool}.`);continue;}
  const data=parsed(call);
  if(call.externalEffects){if(call.verified===true)checked++;else limitations.push(`Action acquittée mais non vérifiée indépendamment : ${call.tool}.`);}
  else {checked++;if(incompleteToolResult(call.result))limitations.push(`Source partielle : ${call.tool}.`);}
 }
 return {checked,limitations:[...new Set(limitations)]};
}
