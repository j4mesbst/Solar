import type {CortexToolCall} from '../lib/cortex/tool-runtime.ts';

const words=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/\p{L}+/gu)??[];
/** Only plain French/brevity instructions are interpretable by this emitter.
 * Unknown language, format or personal rules retain normal model execution. */
export function plainFactStyle(instructions:string){
 const clauses=instructions.normalize('NFKC').trim().split(/[.!;\n]+/).map(s=>s.trim()).filter(Boolean);
 const manner='(?:en français|naturellement|brièvement|directement|concis|court|sans préambule|sans introduction)';
 const style=new RegExp(`^(?:réponds|sois) ${manner}(?:(?: et |, ?| )${manner})*$`,'i');
 return clauses.every(c=>style.test(c)||/^respecte(?: strictement)? la longueur demandée(?:,? sans (?:préambule|introduction))?$/i.test(c)||/^n(?:e |[’'])?(?:fabrique pas de résultats|invente (?:pas de résultats|rien))$/i.test(c));
}
const factWords=new Set(words('vérifie vérifier consulte consulter montre donne indique depuis quand mon le la les repo dépôt repository GitHub n a pas été mis mise à jour et combien de contributions figurent figurant sur profil compte nombre total date exacte exact dernier dernière push activité du code son sa mes des un une maximum mots pour est sont il y jours actuellement maintenant'));
const read=(calls:CortexToolCall[],name:string)=>{const found=calls.filter(c=>c.tool===name);if(found.length!==1||!found[0].completed||found[0].externalEffects)return;try{return JSON.parse(found[0].result);}catch{return;}};
const isoDay=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value.slice(0,10)?value.slice(0,10):undefined;

/** A typed readback, not a summarizer: no email/Slack prose, guesses, writes or
 * cached answers. A vocabulary/shape mismatch returns to the full agent. All
 * source acquisition, consent and parameter checks happen before this point. */
export function emitGitHubFacts(prompt:string,calls:CortexToolCall[],now=Date.now()):string|undefined{
 const positive=prompt.replace(/n['’]a pas été mis[e]? à jour/gi,'mis à jour');
 if(![1,2].includes(calls.length)||/\b(?:ne|pas|sans|ignore|pourquoi|analyse|compare)\b/i.test(positive))return;
 const repo=prompt.match(/\b([\w.-]+\/[\w.-]+)\b/)?.[1];if(!repo)return;
 const limit=prompt.match(/\bmaximum\s+(\d{1,4})\s+mots\b/i)?.[1];
 const query=prompt.replace(repo,'').replace(/\bmaximum\s+\d{1,4}\s+mots\b[.!]?/i,'');
 // A repository-only lookup should not pay for profile discovery or an LLM.
 // Keep the same strict vocabulary, fresh evidence and caller context guards.
 if(calls.length===1){
  const clean=positive.replace(repo,'').replace(/\bmaximum\s+\d{1,4}\s+mots\b[.!]?/i,'');
  if(/\d|[{}<>]/.test(clean)||!words(clean).every(word=>factWords.has(word))||/profil|contribut/i.test(clean)||!/mis[e]? à jour|dernier.*push|activité|depuis quand/i.test(clean))return;
  const activity=read(calls,'github.repository_activity');
  if(!activity||activity.partial||activity.limitation||String(activity.repository).toLowerCase()!==repo.toLowerCase())return;
  const day=isoDay(activity.lastPushAt);
  if(!day||Date.parse(activity.lastPushAt)>now)return;
  const elapsed=Math.floor((now-Date.parse(activity.lastPushAt))/86400000);
  const answer=`Dépôt ${repo} : dernier push le ${day} (UTC), il y a ${elapsed} jour${elapsed===1?'':'s'}.`;
  return limit&&answer.split(/\s+/).length>Number(limit)?undefined:answer;
 }
 const profileCount=/(?:combien(?: de)?|nombre(?: total)? de) contributions(?: figurent| figurant)? sur mon profil(?: GitHub)?/i;
 if(/\d|[{}<>]/.test(query)||!words(query).every(word=>factWords.has(word))||!profileCount.test(query)||(query.match(/contributions?/gi)??[]).length!==1||!/mis[e]? à jour|dernier.*push|activité|depuis quand/i.test(query))return;
 const activity=read(calls,'github.repository_activity'),profile=read(calls,'github.profile_activity');
 if(!activity||!profile||activity.partial||profile.partial||activity.limitation||profile.limitation||String(activity.repository).toLowerCase()!==repo.toLowerCase())return;
 const date=isoDay(activity.lastPushAt),from=isoDay(profile.period?.from),to=isoDay(profile.period?.to),count=profile.contributions?.contributionCalendar?.totalContributions;
 if(!date||!from||!to||from>=to||!Number.isSafeInteger(count)||count<0||Date.parse(activity.lastPushAt)>now)return;
 const elapsed=Math.floor((now-Date.parse(activity.lastPushAt))/86400000);
 const answer=`Dépôt ${repo} : dernier push le ${date} (UTC), il y a ${elapsed} jour${elapsed===1?'':'s'}. Profil GitHub : ${new Intl.NumberFormat('fr-FR').format(count)} contributions visibles du ${from} au ${to}.`;
 if(limit&&answer.split(/\s+/).length>Number(limit))return;
 return answer;
}

const ticketWords=new Set(words('liste montre donne mes les tickets issues Linear dans l ordre de priorité par avec leurs échéances et dates premier premiers un une deux trois quatre cinq six sept huit neuf dix tous toutes'));
const counts:Record<string,number>={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10};
const escape=(text:string)=>text.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/[\\`*_{}\[\]()<>#!|~]/g,'\\$&');
export function emitLinearFacts(prompt:string,calls:CortexToolCall[]):string|undefined{
 if(calls.length!==1||!/^\s*(?:liste|montre)\s+mes\s+(?:tickets|issues)\s+Linear\b/i.test(prompt))return;
 const query=prompt.replace(/\bmaximum\s+\d{1,4}\s+mots\b[.!]?/i,'');
 const requested=query.match(/\b(?:les|mes)\s+(\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:premiers\s+)?(?:tickets|issues)\b/i);
 const count=requested?(counts[requested[1].toLowerCase()]??Number(requested[1])):undefined;
 if(count!==undefined&&(count<1||count>10||!/priorité/i.test(query)||/\b(?:tous|toutes?)\b/i.test(query))||/\d/.test(query.replace(requested?.[1]??'',''))||!words(query).every(word=>ticketWords.has(word)))return;
 const page=read(calls,'linear.list_issues');
 // An omitted pagination flag is unknown, never proof of a complete page. In
 // particular older adapters/fixtures must use the adaptive engine unchanged.
 if(!page||page.partial!==false||page.nextCursor||!Array.isArray(page.issues)||page.issues.length>50)return;
 const rows=page.issues as Record<string,unknown>[];
 if(rows.some(r=>typeof r.identifier!=='string'||!/^[A-Za-z][\w-]*-\d+$/.test(r.identifier)||typeof r.title!=='string'||r.title.length>250||!Number.isInteger(r.priority)||Number(r.priority)<0||Number(r.priority)>4||r.dueDate==null&&r.due!=null||r.dueDate!=null&&!isoDay(r.dueDate)))return;
 if(count!==undefined&&rows.length<count||count===undefined&&rows.length>10)return;
 const ordered=[...rows].sort((a,b)=>(Number(a.priority)||5)-(Number(b.priority)||5));
 const priority=['non définie','Urgente','Élevée','Normale','Faible'];
 const selected=ordered.slice(0,count??rows.length);
 const answer=selected.length?selected.map((r,index)=>`${index+1}. ${r.identifier} — ${escape(String(r.title))} ; priorité ${priority[Number(r.priority)]} ; échéance ${r.dueDate?isoDay(r.dueDate):'non précisée'}.`).join('\n'):'Aucun ticket affecté à ton compte Linear.';
 const limit=prompt.match(/\bmaximum\s+(\d{1,4})\s+mots\b/i)?.[1];if(limit&&answer.split(/\s+/).length>Number(limit))return;
 return answer;
}
export function emitStructuredFacts(prompt:string,calls:CortexToolCall[]){return emitGitHubFacts(prompt,calls)??emitLinearFacts(prompt,calls);}
