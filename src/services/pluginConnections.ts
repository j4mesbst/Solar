import { removeConnection, savedConnection, revokeGmailToken } from "./solarConnect.ts";
import type { PluginId } from "./pluginCatalog.ts";
export type { PluginId } from "./pluginCatalog.ts";
import { identifyIntegration, integrationRequest } from "./integrationApi.ts";
export interface PluginItem {id:string;title:string;detail:string;url?:string}
async function api(id:PluginId,path:string,override?:string,signal?:AbortSignal){
 return integrationRequest(id,path,{token:override,signal});
}
export const pluginIdentity=identifyIntegration;
export async function disconnectPlugin(id:PluginId){const saved=await savedConnection(id);await removeConnection(id);if(id==="gmail"&&saved?.accessToken)void revokeGmailToken(saved.accessToken);}
const decode=(value:string)=>new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)));
export async function listPluginItems(id:PluginId,query:string,signal?:AbortSignal):Promise<PluginItem[]>{
 if(id==="github"){const values=await api(id,"/user/repos?per_page=100&sort=updated",undefined,signal);if(!Array.isArray(values))throw new Error("Réponse GitHub invalide.");return values.filter((repo:{full_name:string})=>repo.full_name.toLowerCase().includes(query.toLowerCase())).slice(0,30).map((repo:{full_name:string;description:string;private:boolean})=>({id:repo.full_name,title:repo.full_name,detail:repo.description??(repo.private?"Dépôt privé":"Dépôt public"),url:`https://github.com/${repo.full_name}`}));}
 const values=await api(id,"/messages?maxResults=10&q="+encodeURIComponent(query),undefined,signal);return await Promise.all((values.messages??[]).map(async({id:messageId}:{id:string})=>{const mail=await api(id,`/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,undefined,signal);const headers=mail.payload?.headers??[];return {id:messageId,title:headers.find((h:{name:string})=>h.name.toLowerCase()==="subject")?.value??"Sans objet",detail:headers.find((h:{name:string})=>h.name.toLowerCase()==="from")?.value??"Gmail"};}));
}
export async function readPluginItem(id:PluginId,item:PluginItem,signal?:AbortSignal):Promise<string>{
 if(id==="github"){if(!/^[\w.-]+\/[\w.-]+$/.test(item.id))throw new Error("Dépôt invalide.");const readme=await api(id,`/repos/${item.id}/readme`,undefined,signal);if(readme.encoding!=="base64")throw new Error("Format README non pris en charge.");return `Dépôt GitHub : ${item.title}\nSource : ${item.url}\n\n${decode(readme.content).slice(0,60000)}`;}
 const mail=await api(id,`/messages/${encodeURIComponent(item.id)}?format=full`,undefined,signal);const textParts:string[]=[];
 const walk=(part:{mimeType?:string;body?:{data?:string};parts?:unknown[]})=>{if(part.mimeType==="text/plain"&&part.body?.data)textParts.push(decode(part.body.data));for(const child of part.parts??[])walk(child as typeof part);};walk(mail.payload??{});
 return `E-mail Gmail : ${item.title}\nDe : ${item.detail}\n\n${(textParts.join("\n")||mail.snippet||"Contenu texte non disponible.").slice(0,60000)}`;
}
export async function readGitHubFile(repository:string,path:string,signal?:AbortSignal):Promise<string>{
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository)||!path||path.length>400||path.split("/").some(segment=>!segment||segment==="."||segment===".."))throw new Error("Chemin GitHub invalide.");
 const item=await api("github",`/repos/${repository}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,undefined,signal);
 if(item.type!=="file"||item.encoding!=="base64"||typeof item.content!=="string")throw new Error("Fichier GitHub indisponible dans ce format.");
 return decode(item.content).slice(0,60000);
}
export async function listGitHubIssues(repository:string,kind:"issues"|"pulls",signal?:AbortSignal):Promise<{number:number;title:string;state:string;url:string;body:string}[]>{
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository))throw new Error("Dépôt invalide.");
 const values=await api("github",`/repos/${repository}/${kind}?state=all&per_page=20`,undefined,signal);
 if(!Array.isArray(values))throw new Error("Réponse GitHub invalide.");
 return values.filter(item=>kind==="pulls"||!item.pull_request).map(item=>({number:item.number,title:String(item.title??"").slice(0,300),state:String(item.state??""),url:String(item.html_url??""),body:String(item.body??"").slice(0,8000)}));
}
