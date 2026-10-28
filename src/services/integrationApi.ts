import { secureIntegrationFetch } from "./secureIntegrationFetch.ts";
import type { PluginId } from "./pluginCatalog.ts";
import { directOAuthProfile } from "./directOAuth.ts";
import { connectionToken } from "./solarConnect.ts";
import { savedConnection } from "./pluginAccounts.ts";
export async function integrationFetch(url:string,init:RequestInit={}){return secureIntegrationFetch(false)(url,init);}
const graph="https://graph.microsoft.com/v1.0/me";
export const roots:Record<PluginId,string>={
 github:"https://api.github.com",gmail:"https://gmail.googleapis.com/gmail/v1/users/me",notion:"https://api.notion.com/v1",slack:"https://slack.com/api",linear:"https://api.linear.app",todoist:"https://api.todoist.com/api/v1",discord:"https://discord.com/api/v10",
 "google-drive":"https://www.googleapis.com/drive/v3","google-calendar":"https://www.googleapis.com/calendar/v3","google-contacts":"https://people.googleapis.com/v1","google-docs":"https://docs.googleapis.com/v1","google-sheets":"https://sheets.googleapis.com/v4","google-tasks":"https://tasks.googleapis.com/tasks/v1",
 outlook:graph,"ms-calendar":graph,onedrive:graph,"ms-todo":graph,"ms-contacts":graph,onenote:graph,
 airtable:"https://api.airtable.com/v0",figma:"https://api.figma.com/v1",asana:"https://app.asana.com/api/1.0",clickup:"https://api.clickup.com/api/v2",monday:"https://api.monday.com",gitlab:"https://gitlab.com/api/v4",hubspot:"https://api.hubapi.com",vercel:"https://api.vercel.com",netlify:"https://api.netlify.com/api/v1",cloudflare:"https://api.cloudflare.com/client/v4",webflow:"https://api.webflow.com/v2",brevo:"https://api.brevo.com/v3",readwise:"https://readwise.io/api",
};
export interface IntegrationOptions {preferText?:boolean;method?:string;body?:unknown;token?:string;auth?:string;signal?:AbortSignal;contentType?:string;responseText?:boolean}
export async function integrationRequest(id:PluginId,path:string,init:IntegrationOptions={}):Promise<any>{
 if(!roots[id]||!path.startsWith("/")||path.startsWith("//")||path.includes("#")||/^[^?]*(?:\\\\|%2e|%2f|%5c)/i.test(path))throw Error("Chemin d’API invalide.");
 const base=new URL(roots[id]),url=new URL(roots[id]+path);
 if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname.replace(/\/$/,"")+"/"))throw Error("Chemin hors du service autorisé.");
 const token=init.token??await connectionToken(id);if(!token)throw Error("Connecte ce service dans Plugins.");
 const auth=init.auth??(await savedConnection(id))?.auth;
 const headers:Record<string,string>={Accept:init.responseText?"text/plain, text/html":"application/json"};
 if(id==="figma"&&auth==="api-key")headers["X-Figma-Token"]=token;
 else if(id==="brevo")headers["api-key"]=token;
 else headers.Authorization=id==="linear"&&auth==="api-key"||id==="monday"||id==="clickup"?token:`${id==="discord"&&auth==="bot"?"Bot":id==="readwise"?"Token":"Bearer"} ${token}`;
 if(init.body!==undefined)headers["Content-Type"]=init.contentType??"application/json";
 if(init.preferText&&base.hostname==="graph.microsoft.com")headers.Prefer='outlook.body-content-type="text"';
 if(id==="github")headers["X-GitHub-Api-Version"]="2022-11-28";
 if(id==="notion")headers["Notion-Version"]="2025-09-03";
 const response=await integrationFetch(url.href,{method:init.method??"GET",headers,body:init.body===undefined?undefined:init.contentType?String(init.body):JSON.stringify(init.body),signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
 if(!response.ok){
  if(response.status===401)throw Error("Autorisation expirée ou révoquée. Reconnecte ce service.");
  if(response.status===403)throw Error("Accès refusé. Vérifie les permissions accordées et l’activation de l’API chez le fournisseur.");
  if(response.status===429)throw Error(`Limite de débit atteinte. Réessaie après ${response.headers.get("retry-after")??"quelques"} secondes ; aucune action n’a été rejouée.`);
  throw Error(`Service indisponible (HTTP ${response.status}). Vérifie la ressource et, après une écriture, son état avant de réessayer.`);
 }
 const text=await response.text();if(text.length>2_000_000)throw Error("Réponse du service trop volumineuse.");
 if(init.responseText)return text;
 const data=text?JSON.parse(text):{ok:true};
 if(id==="slack"&&data.ok!==true)throw Error(`Slack a refusé l’opération (${String(data.error??"erreur").slice(0,80)}). Vérifie les permissions.`);
 if((id==="linear"||id==="monday"||id==="github")&&data.errors?.length)throw Error("Le service a refusé la requête. Vérifie les droits et les identifiants.");
 if(id==="cloudflare"&&data.success!==true)throw Error("Cloudflare a refusé l’opération.");
 return data;
}
export async function identifyIntegration(id:PluginId,token?:string,auth?:string,signal?:AbortSignal):Promise<string>{
 const request=(path:string,body?:unknown)=>integrationRequest(id,path,{token,auth,signal,...(body?{method:"POST",body}:{})});
 let identity:string|undefined;
 const profile=directOAuthProfile(id);
 if(profile?.provider==="google"&&id!=="gmail"){
  const accessToken=token??await connectionToken(id);
  const response=await integrationFetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${accessToken}`},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(!response.ok)throw Error("Google n’a pas confirmé le compte. Reconnecte ce service.");
  const data=await response.json();identity=data.email;
 }else if(profile?.provider==="microsoft"){const data=await request("/?$select=id,displayName,mail,userPrincipalName");identity=data.mail??data.userPrincipalName??data.displayName;}
 else if(id==="github")identity=(await request("/user")).login;
 else if(id==="gmail")identity=(await request("/profile")).emailAddress;
 else if(id==="notion"){const data=await request("/users/me");identity=data.bot?.workspace_name??data.name??data.id;}
 else if(id==="slack"){const data=await request("/auth.test");if(data.team&&data.user)identity=`${data.team} · ${data.user}`;}
 else if(id==="linear"){const data=await request("/graphql",{query:"query { viewer { id name organization { name } } }"});if(data.data?.viewer?.name&&data.data.viewer.organization?.name)identity=`${data.data.viewer.organization.name} · ${data.data.viewer.name}`;}
 else if(id==="discord"){const data=await request("/users/@me");if(auth==="bot"&&!data.bot)throw Error("Discord exige un token de bot officiel ; les comptes utilisateurs automatisés sont refusés.");identity=data.username?`${data.username}${data.bot?" · bot":" · utilisateur"}`:undefined;}
 else if(id==="todoist"){const data=await request("/user");identity=data.email??data.full_name;}
 else if(id==="airtable"){const data=await request("/meta/whoami");identity=data.id?`Airtable · ${data.id}`:undefined;}
 else if(id==="figma"){const data=await request("/me");identity=data.email??data.handle;}
 else if(id==="asana"){const data=await request("/users/me");identity=data.data?.email??data.data?.name;}
 else if(id==="clickup"){const data=await request("/user");identity=data.user?.email??data.user?.username;}
 else if(id==="monday"){const data=await request("/v2",{query:"query { me { id name email } }"});identity=data.data?.me?.email??data.data?.me?.name;}
 else if(id==="gitlab"){const data=await request("/user");identity=data.username;}
 else if(id==="hubspot"){const data=await request("/account-info/v3/details");identity=data.portalId?`HubSpot · ${data.portalId}`:undefined;}
 else if(id==="vercel"){const data=await request("/v2/user");identity=data.user?.email??data.user?.username;}
 else if(id==="netlify"){const data=await request("/user");identity=data.email??data.full_name;}
 else if(id==="cloudflare"){const data=await request("/user/tokens/verify");if(data.result?.status==="active"&&data.result.id)identity=`Cloudflare · jeton ${data.result.id}`;}
 else if(id==="webflow"){const data=await request("/token/introspect");identity=data.authorization?.id?`Webflow · ${data.authorization.id}`:undefined;}
 else if(id==="brevo"){const data=await request("/account");identity=data.email??data.companyName;}
 else if(id==="readwise"){await request("/v2/auth/");identity="Readwise · accès du jeton vérifié";}
 if(typeof identity!=="string"||!identity.trim()||identity.includes("undefined"))throw Error("Le fournisseur n’a pas confirmé l’accès du compte ou du jeton.");
 return identity;
}
