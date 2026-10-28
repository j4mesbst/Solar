import { currentAccountScope } from "./accountScope.ts";
import { invoke } from "@tauri-apps/api/core";
import { pluginInfo,type PluginId } from "./pluginCatalog.ts";
import { savedConnection,saveConnection,removeConnection } from "./pluginAccounts.ts";
import { identifyIntegration,integrationFetch } from "./integrationApi.ts";
import { directOAuthProfile,missingOAuthScopes } from "./directOAuth.ts";
export { savedConnection,saveConnection,removeConnection } from "./pluginAccounts.ts";
export type { ConnectedAccount } from "./pluginAccounts.ts";
const native=()=>typeof window!=="undefined"&&Boolean((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
const env=(key:string)=>(import.meta as ImportMeta&{env?:Record<string,string>}).env?.[key]??"";
const clientId=(id:PluginId)=>env(directOAuthProfile(id)?.envKey??(id==="github"?"VITE_GITHUB_APP_CLIENT_ID":`VITE_${id.toUpperCase()}_CLIENT_ID`));
const network=integrationFetch;
export async function tokenRequest(url:string,body:URLSearchParams,signal?:AbortSignal){
 let response:Response;
 if(native()&&url==="https://oauth2.googleapis.com/token"){
  const id=crypto.randomUUID(),abort=()=>{void invoke("integration_cancel",{id});};signal?.throwIfAborted();signal?.addEventListener("abort",abort,{once:true});
  try{const value=await invoke<{status:number;headers:Record<string,string>;body:string}>("oauth_google_token",{id,body:body.toString()});signal?.throwIfAborted();response=new Response(value.body,{status:value.status,headers:value.headers});}finally{signal?.removeEventListener("abort",abort);}
 }else response=await network(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:body.toString(),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 const result=await response.json();
 if(!response.ok||result.error||result.ok===false){const codes:Record<string,string>={invalid_client:"Le fournisseur refuse la configuration OAuth de Solar. Installe la dernière version de l’app.",invalid_grant:"Le code d’autorisation a expiré ou a déjà été utilisé. Relance la connexion dans Solar.",access_denied:"La connexion a été refusée dans le navigateur.",invalid_scope:"Les permissions demandées ne sont pas disponibles pour ce compte."};throw Error(codes[String(result.error)]??"Le fournisseur n’a pas terminé la connexion. Vérifie les permissions, puis réessaie dans Solar.");}
 const value=result.authed_user?.access_token?{...result,...result.authed_user}:result;
 if(!value.access_token||typeof value.access_token!=="string")throw Error("Le fournisseur n’a pas délivré de jeton utilisable.");
 return value as {access_token:string;refresh_token?:string;expires_in?:number;scope?:string;token_type?:string};
}
export async function revokeGmailToken(token:string){try{await network("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token}).toString(),signal:AbortSignal.timeout(10000)});}catch{/* Local removal remains possible. */}}
const refreshes=new Map<string,Promise<string>>();
export async function connectionToken(id:PluginId):Promise<string>{
 const owner=currentAccountScope(),saved=await savedConnection(id);if(!saved)throw Error("Connecte ce service dans Plugins.");
 if(!saved.expiresAt||saved.expiresAt>Date.now()+60000)return saved.accessToken;
 // GitHub explicitly permits secretless refresh for tokens issued by Device Flow.
 if(id==="github"&&saved.oauthFlow!=="device")throw Error("La session GitHub a expiré. Reconnecte GitHub avec le bouton Continue with GitHub.");
 const endpoint=directOAuthProfile(id)?.token??(id==="github"?"https://github.com/login/oauth/access_token":id==="linear"?"https://api.linear.app/oauth/token":id==="slack"?"https://slack.com/api/oauth.v2.access":undefined);
 if(!saved.refreshToken||!endpoint||saved.tokenEndpoint!==endpoint)throw Error("Autorisation expirée. Reconnecte ce service.");
 const key=`${owner}:${id}:${saved.id}`,running=refreshes.get(key);if(running)return running;
 const operation=(async()=>{
  const result=await tokenRequest(endpoint,new URLSearchParams({client_id:saved.clientId??clientId(id),refresh_token:saved.refreshToken!,grant_type:"refresh_token"}));
  if(currentAccountScope()!==owner||(await savedConnection(id))?.id!==saved.id)throw Error("Le compte connecté a changé.");
  await saveConnection(id,{...saved,accessToken:result.access_token,refreshToken:result.refresh_token??saved.refreshToken,scopes:result.scope?.split(/[ ,]+/)??saved.scopes,expiresAt:result.expires_in?Date.now()+result.expires_in*1000:undefined});return result.access_token;
 })();refreshes.set(key,operation);try{return await operation;}finally{refreshes.delete(key);}
}
function randomString(size=32){const bytes=crypto.getRandomValues(new Uint8Array(size));return Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");}
function base64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
export async function connectGmail(signal?:AbortSignal,_write=true){return connectOAuth("gmail",signal??new AbortController().signal);}
export async function connectGitHub(onCode: (code: string, url: string) => void, signal: AbortSignal): Promise<string> {
  const owner=currentAccountScope();
  if (!native()) throw new Error("Connexion GitHub disponible dans l’application macOS native.");
  const id = clientId("github"); if (!id) throw new Error("Configure VITE_GITHUB_APP_CLIENT_ID pour Solar Connect.");
  const response = await network("https://github.com/login/device/code", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id }).toString(), signal, redirect: "error" });
  const device = await response.json() as { device_code?: string; user_code?: string; verification_uri?: string; interval?: number; expires_in?: number; error?: string };
  if (!response.ok || !device.device_code || !device.user_code || device.verification_uri !== "https://github.com/login/device") throw new Error(`Flux GitHub indisponible${device.error ? ` (${device.error})` : ""}.`);
  onCode(device.user_code, device.verification_uri); await invoke("oauth_open", { url: device.verification_uri });
  const deadline = Date.now() + Math.min(device.expires_in ?? 900, 900) * 1000; let interval = Math.max(5, device.interval ?? 5);
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => { const abort=()=>{clearTimeout(timer);reject(new DOMException("Annulé","AbortError"));};const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},interval*1000);signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort(); });
    const token = await network("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, device_code: device.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }).toString(), signal, redirect: "error" });
    const result = await token.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (result.access_token) {
      const response = await network("https://api.github.com/user", { headers: { Authorization: `Bearer ${result.access_token}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(20_000) });
      const profile = await response.json().catch(()=>{throw Error(`GitHub n’a pas fourni de réponse d’identité lisible (HTTP ${response.status}). Relance la connexion avec la dernière version de Solar.`);}) as { login?: string };
      if (!response.ok || !profile.login) throw new Error("GitHub n’a pas confirmé l’identité du compte.");
      signal.throwIfAborted(); if(currentAccountScope()!==owner)throw Error("Compte Solar modifié.");
      await saveConnection("github", { accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: result.expires_in ? Date.now() + result.expires_in * 1000 : undefined, identity: profile.login,auth:"oauth",oauthFlow:"device",clientId:id,tokenEndpoint:"https://github.com/login/oauth/access_token" });
      return profile.login;
    }
    if (result.error === "slow_down") { interval += 5; continue; }
    if (result.error === "authorization_pending") continue;
    if (result.error === "expired_token") throw new Error("Le code GitHub a expiré. Relance la connexion pour obtenir un nouveau code.");
    if (result.error === "access_denied") throw new Error("La connexion GitHub a été annulée dans le navigateur. Tu peux réessayer.");
    throw new Error(`Autorisation GitHub refusée (${result.error ?? token.status}).`);
  }
  throw new Error("Autorisation GitHub expirée.");
}


export function oauthConfiguration(id:PluginId){
 const info=pluginInfo(id),publicId=clientId(id);
 const ready=info?.connection==="direct"&&Boolean(publicId);
 return {ready,reason:info?.connection==="key"?"Une clé API est nécessaire.":!publicId?"Connexion en préparation. L’identifiant de Solar doit être configuré.":"Autorisation dans le navigateur système.",clientId:publicId};
}
export async function connectApiKey(id:PluginId,token:string,signal?:AbortSignal){
 if(pluginInfo(id)?.connection!=="key")throw Error("Ce service utilise la connexion directe.");
 if(!native())throw Error("Les clés sont enregistrées uniquement dans le Trousseau de l’application macOS.");
 if(!token.trim()||token.length>16000||/[\r\n]/.test(token))throw Error("Clé invalide.");
 const owner=currentAccountScope(),auth=id==="discord"?"bot":"api-key";
 const identity=await identifyIntegration(id,token.trim(),auth,signal);signal?.throwIfAborted();
 if(currentAccountScope()!==owner)throw Error("Compte Solar modifié.");
 await saveConnection(id,{accessToken:token.trim(),identity,auth,enabled:true});return identity;
}
export async function connectOAuth(id:PluginId,signal:AbortSignal,_write=true):Promise<string>{
 const owner=currentAccountScope();signal.throwIfAborted();
 if(!native())throw Error("Ouvre Solar sur macOS pour autoriser cette connexion.");
 if(id==="github")return connectGitHub(()=>{},signal);
 const config=oauthConfiguration(id);if(!config.ready)throw Error(config.reason);
 const profile=directOAuthProfile(id);
 if(!profile&&id!=="linear"&&id!=="slack")throw Error("Connexion directe indisponible.");
 const state=randomString(),verifier=randomString(48),challenge=base64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
 const configuredRedirect=id==="linear"?env("VITE_LINEAR_REDIRECT_URI")||"http://127.0.0.1:18765/oauth/callback":id==="slack"?env("VITE_SLACK_REDIRECT_URI")||"http://localhost:18766/oauth/callback":"";
 const parsed=configuredRedirect?new URL(configuredRedirect):undefined;
 if(parsed&&(parsed.protocol!=="http:"||!["localhost","127.0.0.1"].includes(parsed.hostname)||parsed.pathname!=="/oauth/callback"||parsed.search||parsed.hash||parsed.username||parsed.password))throw Error("Adresse de retour OAuth invalide.");
 const port=await invoke<number>("oauth_begin",{state,port:parsed?Number(parsed.port||80):undefined});
 const redirect=configuredRedirect||(profile?.provider==="microsoft"?`http://localhost:${port}/`:`http://127.0.0.1:${port}/oauth/callback`);
 const cancel=()=>{void invoke("oauth_cancel",{state});};signal.addEventListener("abort",cancel,{once:true});
 try{
  const url=new URL(profile?.authorize??(id==="linear"?"https://linear.app/oauth/authorize":"https://slack.com/oauth/v2/authorize"));
  url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:redirect,response_type:"code",state,code_challenge:challenge,code_challenge_method:"S256"}).toString();
  if(profile){url.searchParams.set("scope",profile.scopes.join(" "));url.searchParams.set("prompt",profile.provider==="google"?"consent":"select_account");if(profile.provider==="google"){url.searchParams.set("access_type","offline");url.searchParams.set("include_granted_scopes","false");}}
  if(id==="linear")url.searchParams.set("scope","read,write");
  if(id==="slack"){url.searchParams.set("scope","");url.searchParams.set("user_scope","channels:read,groups:read,channels:history,groups:history,search:read,chat:write");}
  signal.throwIfAborted();await invoke("oauth_open",{url:url.href});
  const path=await invoke<string>("oauth_wait",{state});signal.throwIfAborted();const query=new URL(path,redirect).searchParams;
  if(query.get("state")!==state||query.has("error")||!query.get("code"))throw Error("Autorisation refusée. Tu peux réessayer depuis Solar.");
  const endpoint=profile?.token??(id==="linear"?"https://api.linear.app/oauth/token":"https://slack.com/api/oauth.v2.access");
  const result=await tokenRequest(endpoint,new URLSearchParams({client_id:config.clientId,code:query.get("code")!,redirect_uri:redirect,grant_type:"authorization_code",code_verifier:verifier}),signal);
  // OAuth 2.0 permits omitting scope when it is identical to the request.
  const grantedScope=result.scope??query.get("scope")??profile?.scopes.join(" ");
  if(profile&&missingOAuthScopes(profile,grantedScope).length)throw Error("Certaines permissions nécessaires ont été refusées. Reconnecte le service et vérifie les droits demandés.");
  const identity=await identifyIntegration(id,result.access_token,"oauth",signal);signal.throwIfAborted();
  if(currentAccountScope()!==owner)throw Error("Compte Solar modifié.");
  await saveConnection(id,{accessToken:result.access_token,refreshToken:result.refresh_token,expiresAt:result.expires_in?Date.now()+result.expires_in*1000:undefined,identity,scopes:grantedScope?.split(/[ ,]+/),auth:"oauth",oauthFlow:"pkce",clientId:config.clientId,tokenEndpoint:endpoint,redirectUri:redirect});return identity;
 }finally{signal.removeEventListener("abort",cancel);await invoke("oauth_cancel",{state}).catch(()=>{});}
}
export async function disconnectConnection(id:PluginId,signal?:AbortSignal):Promise<string>{
 const account=await savedConnection(id);if(!account)return "Non connecté";
 let revoked=false;
 try{
  let endpoint:string|undefined,body:URLSearchParams|undefined;
  if(account.auth==="oauth"){
   if(directOAuthProfile(id)?.provider==="google"){endpoint="https://oauth2.googleapis.com/revoke";body=new URLSearchParams({token:account.refreshToken??account.accessToken});}
   if(id==="slack"){endpoint="https://slack.com/api/auth.revoke";body=new URLSearchParams({token:account.accessToken});}
   if(id==="linear"){endpoint="https://api.linear.app/oauth/revoke";body=new URLSearchParams({token:account.accessToken});}
   if(endpoint&&body){const response=await network(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString(),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});const result=await response.json().catch(()=>({}));revoked=response.ok&&result.ok!==false;}
  }
 }catch{/* Always permit local credential removal. */}
 if((await savedConnection(id))?.id!==account.id)throw Error("Le compte connecté a changé.");
 await removeConnection(id,account.id);return revoked?"Déconnecté · accès révoqué":"Déconnecté localement · révocation disponible dans les paramètres du fournisseur";
}
