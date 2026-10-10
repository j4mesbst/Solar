import { secretVault } from "./nativeVault";
export type PluginId="github"|"gmail";
export interface PluginItem {id:string;title:string;detail:string;url?:string}
let gmailToken="";
const native=()=>Boolean((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
async function api(id:PluginId,path:string,override?:string){
 const token=override??(id==="gmail"?gmailToken:await secretVault.get("plugin:github"));if(!token)throw new Error("Connecte ce plugin pour lire son contenu.");
 const url=(id==="github"?"https://api.github.com":"https://gmail.googleapis.com/gmail/v1/users/me")+path;
 const fetcher=native()?(await import("@tauri-apps/plugin-http")).fetch:fetch;
 const response=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json",...(id==="github"?{"X-GitHub-Api-Version":"2022-11-28"}:{})},signal:AbortSignal.timeout(20000),redirect:"error"});
 if(!response.ok){if(response.status===401){if(id==="gmail")gmailToken="";throw new Error("Autorisation expirée ou refusée. Reconnecte le plugin.");}if(response.status===403)throw new Error("Accès refusé : vérifie les permissions du plugin et l’activation de son API.");throw new Error(`Le service est indisponible (${response.status}).`);}
 const text=await response.text();if(text.length>2_000_000)throw new Error("Réponse trop volumineuse.");return JSON.parse(text);
}
export async function pluginIdentity(id:PluginId){const value=await api(id,id==="github"?"/user":"/profile");const identity=id==="github"?value.login:value.emailAddress;if(typeof identity!=="string"||!identity.trim())throw new Error("Le service n’a pas confirmé l’identité du compte.");return identity;}
export async function connectPlugin(id:PluginId,token:string){if(!token.trim())throw new Error("Entre une autorisation valide.");const value=await api(id,id==="github"?"/user":"/profile",token.trim());const identity=String(id==="github"?value.login:value.emailAddress);if(!identity||identity==="undefined")throw new Error("Le service n’a pas confirmé l’identité du compte.");if(id==="gmail")gmailToken=token.trim();else await secretVault.set("plugin:github",token.trim());return identity;}

export async function disconnectPlugin(id:PluginId){if(id==="gmail"){const token=gmailToken;gmailToken="";if(token)void fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token})}).catch(()=>{});}else await secretVault.delete("plugin:github");}
const decode=(value:string)=>new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)));
export async function listPluginItems(id:PluginId,query:string):Promise<PluginItem[]>{
 if(id==="github"){const values=await api(id,"/user/repos?per_page=100&sort=updated");if(!Array.isArray(values))throw new Error("Réponse GitHub invalide.");return values.filter((repo:{full_name:string})=>repo.full_name.toLowerCase().includes(query.toLowerCase())).slice(0,30).map((repo:{full_name:string;description:string;private:boolean})=>({id:repo.full_name,title:repo.full_name,detail:repo.description??(repo.private?"Dépôt privé":"Dépôt public"),url:`https://github.com/${repo.full_name}`}));}
 const values=await api(id,"/messages?maxResults=10&q="+encodeURIComponent(query));return await Promise.all((values.messages??[]).map(async({id:messageId}:{id:string})=>{const mail=await api(id,`/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`);const headers=mail.payload?.headers??[];return {id:messageId,title:headers.find((h:{name:string})=>h.name.toLowerCase()==="subject")?.value??"Sans objet",detail:headers.find((h:{name:string})=>h.name.toLowerCase()==="from")?.value??"Gmail"};}));
}
export async function readPluginItem(id:PluginId,item:PluginItem):Promise<string>{
 if(id==="github"){if(!/^[\w.-]+\/[\w.-]+$/.test(item.id))throw new Error("Dépôt invalide.");const readme=await api(id,`/repos/${item.id}/readme`);if(readme.encoding!=="base64")throw new Error("Format README non pris en charge.");return `Dépôt GitHub : ${item.title}\nSource : ${item.url}\n\n${decode(readme.content).slice(0,60000)}`;}
 const mail=await api(id,`/messages/${encodeURIComponent(item.id)}?format=full`);const textParts:string[]=[];
 const walk=(part:{mimeType?:string;body?:{data?:string};parts?:unknown[]})=>{if(part.mimeType==="text/plain"&&part.body?.data)textParts.push(decode(part.body.data));for(const child of part.parts??[])walk(child as typeof part);};walk(mail.payload??{});
 return `E-mail Gmail : ${item.title}\nDe : ${item.detail}\n\n${(textParts.join("\n")||mail.snippet||"Contenu texte non disponible.").slice(0,60000)}`;
}
type TokenResponse={access_token?:string;error?:string};
type GoogleWindow=Window & {google?:{accounts:{oauth2:{initTokenClient:(options:{client_id:string;scope:string;callback:(result:TokenResponse)=>void;error_callback:()=>void})=>{requestAccessToken:()=>void}}}}};
export async function authorizeGmail():Promise<string>{
 const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;if(!clientId)throw new Error("La connexion Google doit être configurée avec le client OAuth de Solar.");if(native())throw new Error("Dans cette version macOS, utilise une autorisation Gmail en lecture seule dans les options avancées. La connexion Google par navigateur est disponible dans la version Web.");
 const googleWindow=window as GoogleWindow;
 if(!googleWindow.google){await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error("Impossible de charger la connexion Google."));};document.head.append(script);});}
 return new Promise((resolve,reject)=>{googleWindow.google!.accounts.oauth2.initTokenClient({client_id:clientId,scope:"https://www.googleapis.com/auth/gmail.readonly",callback:result=>result.access_token?resolve(result.access_token):reject(new Error("L’autorisation Gmail n’a pas été accordée.")),error_callback:()=>reject(new Error("La connexion Google a été fermée ou bloquée."))}).requestAccessToken();});
}
