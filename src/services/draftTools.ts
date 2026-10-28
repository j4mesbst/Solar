import {integrationRequest} from './integrationApi.ts';
import {savedConnection} from './pluginAccounts.ts';
import type {ToolDefinition} from './toolRegistry.ts';
const field=(description:string,maxLength=20000)=>({type:'string',minLength:1,maxLength,description});
const parameters={type:'object',properties:{to:field('Destinataire exact',320),subject:field('Objet',500),body:field('Texte intégral du brouillon')},required:['to','subject','body'],additionalProperties:false};
const b64=(value:string)=>btoa(Array.from(new TextEncoder().encode(value),v=>String.fromCharCode(v)).join(''));
const decode=(value:string)=>new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
const decodeHeader=(value:string)=>value.replace(/=\?UTF-8\?B\?([^?]+)\?=/gi,(_match,content)=>decode(content));
function validate(i:any){if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(i.to)||/[\r\n]/.test(i.to+i.subject))throw Error('Destinataire ou objet invalide. Aucun brouillon créé.');}
function gmailBody(payload:any):string{if(payload?.mimeType==='text/plain'&&payload.body?.data)return decode(payload.body.data);return (payload?.parts??[]).map(gmailBody).join('');}
export const draftTools:ToolDefinition[]=['gmail','outlook'].flatMap(plugin=>[
 {name:`${plugin}.create_draft`,pluginId:plugin,description:'Enregistrer un vrai brouillon, vérifier son contenu par relecture, SANS envoyer de message. Les anciens scopes peuvent exiger une reconnexion pour autoriser les brouillons.',parameters,permissions:[`${plugin}.write`],risk:'write',externalEffects:true,
 async execute(value,signal){const i=value as {to:string;subject:string;body:string};validate(i);
  if(plugin==='gmail'){
   const account=await savedConnection('gmail');if(!account?.scopes?.some(scope=>['https://www.googleapis.com/auth/gmail.compose','https://www.googleapis.com/auth/gmail.modify','https://mail.google.com/'].includes(scope)))throw Error('Les brouillons Gmail nécessitent gmail.compose. Reconnecte Gmail pour autoriser cette capacité ; la lecture existante reste disponible.');
   const raw=b64(`To: ${i.to}\r\nSubject: =?UTF-8?B?${b64(i.subject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(i.body)}`).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const created=await integrationRequest('gmail','/drafts',{signal,method:'POST',body:{message:{raw}}});
   if(!created.id)throw Error('Création acquittée sans identifiant. Vérifie le dossier Brouillons avant toute reprise.');
   return {id:created.id,messageId:created.message?.id,sent:false,status:'draft',verification:'pending'};
  }
  const created=await integrationRequest('outlook','/messages',{signal,method:'POST',body:{subject:i.subject,body:{contentType:'Text',content:i.body},toRecipients:[{emailAddress:{address:i.to}}]}});
  if(!created.id)throw Error('Création acquittée sans identifiant ; vérifie les brouillons Outlook avant une reprise.');return {id:created.id,sent:false,status:'draft',verification:'pending'};
 },async verify(value,result,signal){const i=value as any,r=result as any;
  if(plugin==='gmail'){const read=await integrationRequest('gmail',`/drafts/${encodeURIComponent(r.id)}?format=full`,{signal});const headers=read.message?.payload?.headers??[];const header=(name:string)=>headers.find((h:any)=>h.name.toLowerCase()===name.toLowerCase())?.value??'';if(read.id!==r.id||!read.message?.labelIds?.includes('DRAFT')||decodeHeader(header('Subject'))!==i.subject||header('To').trim().toLowerCase()!==i.to.toLowerCase()||gmailBody(read.message?.payload).replace(/\r\n/g,'\n').trimEnd()!==i.body.replace(/\r\n/g,'\n').trimEnd())throw Error('Brouillon créé mais sa relecture ne confirme pas le contenu exact. Ne pas recréer ni envoyer.');}
  else{const read=await integrationRequest('outlook',`/messages/${encodeURIComponent(r.id)}?$select=id,isDraft,subject,toRecipients,body`,{signal,preferText:true});if(read.id!==r.id||read.isDraft!==true||read.subject!==i.subject||read.body?.contentType?.toLowerCase()!=='text'||read.body?.content?.replace(/\r\n/g,'\n').trimEnd()!==i.body.replace(/\r\n/g,'\n').trimEnd()||!read.toRecipients?.some((x:any)=>x.emailAddress?.address?.toLowerCase()===i.to.toLowerCase()))throw Error('Brouillon Outlook créé, mais contenu non confirmé. Ne pas recréer ni envoyer.');}
  r.verification='verified';
 }} as ToolDefinition,
 {name:`${plugin}.read_draft`,pluginId:plugin,description:'Relire un brouillon existant sans le modifier ni l’envoyer.',parameters:{type:'object',properties:{id:field('Identifiant du brouillon',500)},required:['id'],additionalProperties:false},permissions:[`${plugin}.read`],risk:'read',externalEffects:false,parallelSafe:true,execute:(value,signal)=>{const id=encodeURIComponent((value as any).id);return integrationRequest(plugin as 'gmail'|'outlook',plugin==='gmail'?`/drafts/${id}?format=full`:`/messages/${id}?$select=id,isDraft,subject,toRecipients,body`,{signal,preferText:true});}} as ToolDefinition
]);
