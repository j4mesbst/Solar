import {integrationRequest} from './integrationApi.ts';
import type {ToolDefinition} from './toolRegistry.ts';
const header=(m:any,name:string)=>String(m.payload?.headers?.find((h:any)=>String(h.name).toLowerCase()===name.toLowerCase())?.value??'');
const parameters={type:'object',properties:{limit:{type:'integer',minimum:1,maximum:10},cursor:{type:'string',maxLength:2000}},required:['limit'],additionalProperties:false};
export const followupTools:ToolDefinition[]=['gmail','outlook'].map(service=>({
 name:`${service}.followup_candidates`,pluginId:service,description:'Lire jusqu’à 10 fils de messages envoyés récemment et vérifier qui a écrit en dernier. waiting=true est une réponse possiblement attendue, pas une promesse ni une urgence. Ne jamais envoyer de relance sans instruction.',parameters,permissions:[`${service}.read`],risk:'read',externalEffects:false,parallelSafe:true,
 async execute(input,signal){const {limit,cursor}=input as {limit:number;cursor?:string};const threads:any[]=[];
  if(service==='gmail'){
   const list=await integrationRequest('gmail',`/threads?maxResults=${limit}&q=${encodeURIComponent('in:sent newer_than:14d')}${cursor?'&pageToken='+encodeURIComponent(cursor):''}`,{signal});if(!Array.isArray(list.threads)&&list.threads!==undefined)throw Error('Liste de fils Gmail invalide.');
   for(const item of list.threads??[]){signal.throwIfAborted();const thread=await integrationRequest('gmail',`/threads/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To`,{signal});if(!Array.isArray(thread.messages)||!thread.messages.length)throw Error('Le contenu du fil Gmail est indisponible.');
    const messages=thread.messages.filter((m:any)=>!m.labelIds?.includes('DRAFT')).sort((a:any,b:any)=>Number(a.internalDate)-Number(b.internalDate)),last=messages.at(-1);if(!last)throw Error('Aucun message envoyé ou reçu vérifiable dans ce fil.');
    threads.push({id:thread.id??item.id,subject:header(last,'Subject'),lastMessageId:last.id,lastAt:new Date(Number(last.internalDate)).toISOString(),from:header(last,'From'),to:header(last,'To'),waiting:Array.isArray(last.labelIds)?last.labelIds.includes('SENT'):undefined,basis:'Dernier message étiqueté envoyé par Gmail ; vérifier si une réponse est réellement nécessaire.'});
   }
   return{threads,partial:Boolean(list.nextPageToken),scope:'Fils contenant un message envoyé durant les 14 derniers jours, nombre borné.',nextCursor:list.nextPageToken};
  }
  const own=await integrationRequest('outlook','/?$select=mail,userPrincipalName',{signal}),email=String(own.mail??own.userPrincipalName??'').toLowerCase();if(!email)throw Error('Outlook n’a pas confirmé l’adresse du compte.');
  const sent=await integrationRequest('outlook',`/mailFolders/sentitems/messages?$top=${limit}&$orderby=sentDateTime%20desc&$select=id,conversationId,subject,sentDateTime${cursor?'&$skiptoken='+encodeURIComponent(cursor):''}`,{signal});if(!Array.isArray(sent.value))throw Error('Messages envoyés Outlook indisponibles.');
  let partial=Boolean(sent['@odata.nextLink']);const seen=new Set<string>();
  for(const message of sent.value){signal.throwIfAborted();if(!message.conversationId||seen.has(message.conversationId))continue;seen.add(message.conversationId);
   const filter=encodeURIComponent(`receivedDateTime ge 1970-01-01T00:00:00Z and conversationId eq '${String(message.conversationId).replace(/'/g,"''")}'`);
   const page=await integrationRequest('outlook',`/messages?$filter=${filter}&$orderby=receivedDateTime%20desc&$top=50&$select=id,subject,from,toRecipients,receivedDateTime,sentDateTime,isDraft`,{signal});if(!Array.isArray(page.value)||!page.value.length)throw Error('Le fil Outlook est indisponible.');
   partial||=Boolean(page['@odata.nextLink']);const latest=page.value.filter((m:any)=>!m.isDraft).sort((a:any,b:any)=>Date.parse(a.receivedDateTime??a.sentDateTime)-Date.parse(b.receivedDateTime??b.sentDateTime)).at(-1);if(!latest)throw Error('Aucun message Outlook envoyé ou reçu vérifiable.');
   threads.push({id:message.conversationId,subject:latest.subject,lastMessageId:latest.id,lastAt:latest.receivedDateTime??latest.sentDateTime,from:latest.from?.emailAddress?.address,waiting:latest.from?.emailAddress?.address?String(latest.from.emailAddress.address).toLowerCase()===email:undefined,basis:page['@odata.nextLink']?'Fil partiel, état de réponse inconnu.':'Dernier auteur du fil comparé au compte connecté.'});
  }
  return{threads,partial,nextCursor:sent['@odata.nextLink']?new URL(sent['@odata.nextLink']).searchParams.get('$skiptoken')??undefined:undefined,scope:'Conversations des messages envoyés les plus récents ; recherche bornée, pas une liste exhaustive des engagements.'};
 }
}));
