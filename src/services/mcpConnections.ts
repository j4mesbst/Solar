import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError, type OAuthDiscoveryState, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { invoke } from "@tauri-apps/api/core";
import { secretVault } from "./nativeVault.ts";
import { scopedKey, currentAccountScope } from "./accountScope.ts";
import { secureIntegrationFetch, validateServerUrl } from "./secureIntegrationFetch.ts";
export interface McpServer {id:string;name:string;url:string;auth:"none"|"token"|"oauth";enabled:boolean;local:boolean;clientId?:string;identity?:string;verifiedAt?:string}
export interface McpTool {name:string;description?:string;inputSchema:Record<string,unknown>;annotations?:{readOnlyHint?:boolean;destructiveHint?:boolean;openWorldHint?:boolean}}
const key=()=>scopedKey("solar.mcp.v1");
const native=()=>typeof window!=="undefined"&&Boolean((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
export async function listMcpServers():Promise<McpServer[]>{if(native()){const store=await(await import("@tauri-apps/plugin-store")).load(key()+".json",{defaults:{},autoSave:false});return await store.get<McpServer[]>("servers")??[];}return JSON.parse(localStorage.getItem(key())??"[]");}
let queue=Promise.resolve();
export async function saveMcpServer(server:McpServer){validateServerUrl(server.url,server.local);if(!/^[a-zA-Z0-9-]{1,90}$/.test(server.id)||!server.name.trim())throw Error("Serveur MCP invalide.");const owner=currentAccountScope();const operation=queue.then(async()=>{if(currentAccountScope()!==owner)throw Error("Compte Solar modifié.");const values=await listMcpServers();const next=[...values.filter(item=>item.id!==server.id),server];if(native()){const store=await(await import("@tauri-apps/plugin-store")).load(key()+".json",{defaults:{},autoSave:false});await store.set("servers",next);await store.save();}else localStorage.setItem(key(),JSON.stringify(next));window.dispatchEvent(new Event("solar-plugins-changed"));});queue=operation.catch(()=>{});return operation;}
interface McpCredentials {tokens?:OAuthTokens;client?:OAuthClientInformationMixed;expiresAt?:number;redirect?:string;token?:string}
const credentialKey=(id:string)=>`solar.mcp.${id}.credentials`;
export async function saveMcpToken(id:string,token:string){if(!native())throw Error("Enregistre les tokens MCP dans le Trousseau de Solar macOS.");await secretVault.set(credentialKey(id),JSON.stringify({token}));}
async function credentials(id:string):Promise<McpCredentials>{const raw=await secretVault.get(credentialKey(id));return raw?JSON.parse(raw):{};}
interface McpSession {client:Client;transport:StreamableHTTPClientTransport;tools:McpTool[];owner:string;fingerprint:string}
export const mcpFingerprint=(server:McpServer)=>JSON.stringify([server.id,server.url,server.auth,server.local,server.clientId]);
const sessions=new Map<string,McpSession>();
export async function closeMcp(id:string){const session=sessions.get(id);sessions.delete(id);if(session){try{await session.transport.terminateSession();}catch{/* Session may have expired. */}await session.client.close();}}
export async function disconnectMcp(id:string){await closeMcp(id);await secretVault.delete(credentialKey(id));const server=(await listMcpServers()).find(item=>item.id===id);if(server)await saveMcpServer({...server,enabled:false,verifiedAt:undefined});}
export async function connectMcp(server:McpServer,signal:AbortSignal,interactive=false):Promise<McpSession>{
 validateServerUrl(server.url,server.local);signal.throwIfAborted();
 const existing=sessions.get(server.id);if(existing&&existing.owner===currentAccountScope() && existing.fingerprint===mcpFingerprint(server))return existing;
 if(existing)await closeMcp(server.id);
 const owner=currentAccountScope(),secure=await credentials(server.id);
 const previous=(await listMcpServers()).find(item=>item.id===server.id);
 if(previous&&mcpFingerprint(previous)!==mcpFingerprint(server))throw Error("La configuration a changé. Déconnecte d’abord ce serveur pour retirer ses anciens identifiants, puis reconnecte-le.");
 let codeVerifier="",state="",redirect=secure.redirect??"",authorizedUrl:URL|undefined,discovery:OAuthDiscoveryState|undefined;
 if(interactive&&server.auth==="oauth"){
  if(!native())throw Error("OAuth MCP s’ouvre dans le navigateur système de Solar macOS.");
  state=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,"0")).join("");
  const port=await invoke<number>("oauth_begin",{state});redirect=`http://127.0.0.1:${port}/oauth/callback`;
 }
 const persist=async()=>{if(currentAccountScope()!==owner)throw Error("Compte Solar modifié.");await secretVault.set(credentialKey(server.id),JSON.stringify(secure));};
 const provider:OAuthClientProvider={
  get redirectUrl(){return redirect||undefined;},
  get clientMetadata(){return {client_name:"Solar",redirect_uris:redirect?[redirect]:[],grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_method:"none"};},
  state:()=>state,
  saveDiscoveryState:value=>{discovery=value;},discoveryState:()=>discovery,
  clientInformation:()=>secure.client??(server.clientId?{client_id:server.clientId}:undefined),
  saveClientInformation:async value=>{secure.client=value;secure.redirect=redirect;await persist();},
  tokens:()=>secure.tokens,
  saveTokens:async tokens=>{secure.tokens=tokens;secure.expiresAt=tokens.expires_in?Date.now()+tokens.expires_in*1000:undefined;await persist();},
  redirectToAuthorization:async url=>{if(!interactive)throw Error("Autorisation MCP expirée. Reconnecte le serveur dans Plugins.");if(url.searchParams.get("state")!==state)throw Error("État OAuth MCP invalide.");validateServerUrl(url.href);authorizedUrl=url;},
  saveCodeVerifier:value=>{codeVerifier=value;},codeVerifier:()=>{if(!codeVerifier)throw Error("Session PKCE MCP expirée.");return codeVerifier;},
  invalidateCredentials:async scope=>{if(scope==="all"||scope==="client")delete secure.client;if(scope==="all"||scope==="tokens")delete secure.tokens;await persist();},
 };
 const createTransport=()=>new StreamableHTTPClientTransport(new URL(server.url),{fetch:secureIntegrationFetch(server.local,new URL(server.url).origin),authProvider:server.auth==="oauth"?provider:undefined,requestInit:server.auth==="token"?{headers:{Authorization:`Bearer ${secure.token??""}`}}:undefined,reconnectionOptions:{maxRetries:0,initialReconnectionDelay:1000,maxReconnectionDelay:1000,reconnectionDelayGrowFactor:1}});
 let transport=createTransport();
 let client=new Client({name:"Solar",version:"0.2.0"},{capabilities:{}});
 const abort=()=>{void client.close();if(state)void invoke("oauth_cancel",{state});};signal.addEventListener("abort",abort,{once:true});
 try{
  try{await client.connect(transport,{signal,timeout:30000});}
  catch(error){
   if(!(error instanceof UnauthorizedError)||!authorizedUrl||!interactive)throw error;
   await invoke("oauth_open",{url:(authorizedUrl as URL).href});const callback=await invoke<string>("oauth_wait",{state});signal.throwIfAborted();const params=new URL(callback,redirect).searchParams;
   if(params.get("state")!==state||params.has("error")||!params.get("code"))throw Error("Autorisation MCP refusée.");
   await transport.finishAuth(params.get("code")!);
   await client.close().catch(()=>{});transport=createTransport();
   client=new Client({name:"Solar",version:"0.2.0"},{capabilities:{}});await client.connect(transport,{signal,timeout:30000});
  }
  const tools:McpTool[]=[];let cursor:string|undefined;const cursors=new Set<string>();
  do{const result=await client.listTools(cursor?{cursor}:undefined,{signal,timeout:20000});tools.push(...result.tools as McpTool[]);cursor=result.nextCursor;if(cursor){if(cursors.has(cursor)||cursors.size>=20)throw Error("Pagination MCP sans progrès ou trop volumineuse.");cursors.add(cursor);}if(tools.length>200)throw Error("Le serveur expose trop d’outils. Limite son catalogue.");}while(cursor);
  signal.throwIfAborted();if(owner!==currentAccountScope())throw Error("Compte Solar modifié.");
  const session={client,transport,tools,owner,fingerprint:mcpFingerprint(server)};sessions.set(server.id,session);
  await saveMcpServer({...server,identity:client.getServerVersion()?.name??server.name,verifiedAt:new Date().toISOString(),enabled:true});return session;
 }catch(error){await client.close().catch(()=>{});throw error;}
 finally{signal.removeEventListener("abort",abort);if(state)await invoke("oauth_cancel",{state}).catch(()=>{});}
}
export async function callMcp(server:McpServer,name:string,args:Record<string,unknown>,signal:AbortSignal){
 const session=await connectMcp(server,signal);
 const result=await session.client.callTool({name,arguments:args},undefined,{signal,timeout:40000});
 if(result.isError)throw Error("L’outil MCP a signalé un échec. Vérifie son résultat dans le service avant toute reprise.");return result;
}
