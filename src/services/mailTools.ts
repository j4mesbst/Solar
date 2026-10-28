import type { ToolDefinition } from "./toolRegistry.ts";
import { integrationRequest } from "./integrationApi.ts";
const decode=(text:string)=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)));
const plain=(html:string)=>html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/[ \t]{2,}/g," ").trim();
function gmailText(payload:any){const parts:string[]=[],html:string[]=[];const walk=(p:any)=>{if(p.body?.data){if(p.mimeType==="text/plain")parts.push(decode(p.body.data));else if(p.mimeType==="text/html")html.push(plain(decode(p.body.data)));}for(const child of p.parts??[])walk(child);};walk(payload??{});return (parts.length?parts:html).join("\n\n");}
export const mailTools:ToolDefinition[]=["gmail","outlook"].map(plugin=>({name:`${plugin}.latest_messages`,pluginId:plugin,description:"Lire les derniers e-mails de la boîte de réception avec leur sujet, expéditeur, date, identifiant et contenu. Utiliser pour résumer/analyser les N derniers mails. Lecture uniquement.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:10,description:"Nombre exact de derniers messages demandés (1 à 10)."}},required:["limit"],additionalProperties:false},permissions:[`${plugin}.read`],risk:"read",parallelSafe:true,externalEffects:false,async execute(value,signal){const {limit}=value as {limit:number};if(plugin==="gmail"){
 const list=await integrationRequest("gmail",`/messages?maxResults=${limit}&q=${encodeURIComponent("in:inbox")}`,{signal});
 const messages=[];const items=(list.messages??[]).slice(0,limit);
 // Independent, code-owned reads only. Await every sibling before propagating
 // failure; retain mailbox order and never publish a partially successful page.
 for(let index=0;index<items.length;index+=3){signal.throwIfAborted();const settled=await Promise.allSettled(items.slice(index,index+3).map(async(item:any)=>{signal.throwIfAborted();const mail=await integrationRequest("gmail",`/messages/${encodeURIComponent(item.id)}?format=full`,{signal});const header=(name:string)=>mail.payload?.headers?.find((h:any)=>String(h.name).toLowerCase()===name)?.value??"";const decoded=gmailText(mail.payload);const body=decoded||mail.snippet||"";return {id:mail.id??item.id,subject:header("subject"),from:header("from"),date:header("date"),rfcMessageId:header("message-id")||undefined,body:body.slice(0,12000),partial:body.length>12000||!decoded};}));const failure=settled.find(result=>result.status==="rejected");if(failure?.status==="rejected")throw failure.reason;signal.throwIfAborted();for(const result of settled)if(result.status==="fulfilled")messages.push(result.value);}return {messages,count:messages.length,requested:limit,source:"Gmail · boîte de réception",order:"plus récent en premier"};
 }const data=await integrationRequest("outlook",`/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,body,bodyPreview,webLink`,{signal});return {messages:(data.value??[]).slice(0,limit).map((m:any)=>{const body=m.body?.contentType?.toLowerCase()==="html"?plain(m.body.content):m.body?.content??m.bodyPreview??"";return {id:m.id,webLink:m.webLink,subject:m.subject,from:m.from?.emailAddress,date:m.receivedDateTime,body:body.slice(0,12000),partial:body.length>12000};}),source:"Outlook · boîte de réception",requested:limit,order:"plus récent en premier"};
}} as ToolDefinition));
export function latestMailIntent(prompt:string,services?:string[]){
 if(!services||services.length!==1||!["gmail","outlook"].includes(services[0])||!/\b(?:mails?|emails?|courriels?|messages?)\b/i.test(prompt)||!/derni[eè]r|plus r[eé]cent|latest|newest/i.test(prompt)||/r[eé]pond|envoi|supprim|archive|transf[eè]re|delete|send|reply/i.test(prompt))return undefined;
 const digit=prompt.match(/\b(10|[1-9])\s+(?:derni|plus r[eé]cent|latest|newest)/i)?.[1];const word=prompt.match(/\b(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+derni/i)?.[1]?.toLowerCase();
 const limit=digit?Number(digit):word?["","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix"].indexOf(word):/\b(?:mon|le|ton|son)\s+dernier\s+(?:mail|email|courriel|message)\b/i.test(prompt)?1:undefined;
 return limit?{tool:`${services[0]}.latest_messages`,arguments:{limit}}:undefined;
}

/** Read long messages in addressable parts, so bounded observations do not make
 * the remainder permanently inaccessible to the agent. */
mailTools.push(...["gmail","outlook"].map(plugin=>({
 name:plugin==="gmail"?"gmail.read_message":"outlook.read_message_part",pluginId:plugin,
 description:"Lire le contenu d’un e-mail par parties. Utiliser nextOffset tant qu’il reste des parties utiles ; ne pas inventer le contenu omis.",
 parameters:{type:"object",properties:{id:{type:"string",minLength:1,maxLength:500},offset:{type:"integer",minimum:0},maxCharacters:{type:"integer",minimum:1000,maximum:40000}},required:["id"],additionalProperties:false},
 permissions:[`${plugin}.read`],risk:"read",parallelSafe:true,externalEffects:false,
 async execute(value,signal){const i=value as {id:string;offset?:number;maxCharacters?:number};let body="",subject="";
  if(plugin==="gmail"){const mail=await integrationRequest("gmail",`/messages/${encodeURIComponent(i.id)}?format=full`,{signal});body=gmailText(mail.payload)||mail.snippet||"";subject=mail.payload?.headers?.find((h:any)=>String(h.name).toLowerCase()==="subject")?.value??"";}
  else{const mail=await integrationRequest("outlook",`/messages/${encodeURIComponent(i.id)}?$select=id,subject,body,bodyPreview`,{signal});body=mail.body?.contentType?.toLowerCase()==="html"?plain(mail.body.content):mail.body?.content??mail.bodyPreview??"";subject=mail.subject??"";}
  const offset=i.offset??0,end=Math.min(body.length,offset+(i.maxCharacters??16000));
  return {id:i.id,subject,body:body.slice(offset,end),offset,totalCharacters:body.length,partial:offset>0||end<body.length,nextOffset:end<body.length?end:undefined};
 }
} as ToolDefinition)));

for(const definition of mailTools.filter(t=>t.name.endsWith('.latest_messages')))definition.outputSchema={type:'object',properties:{messages:{type:'array',items:{type:'object',properties:{id:{type:'string',minLength:1},body:{type:'string'}},required:['id','body']}},requested:{type:'integer',minimum:1,maximum:10}},required:['messages','requested']};
