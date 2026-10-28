import { secretVault } from "./nativeVault.ts";
import { currentAccountScope } from "./accountScope.ts";
import type { PluginId } from "./pluginCatalog.ts";
export interface ConnectedAccount {
 accessToken: string; refreshToken?: string; expiresAt?: number; identity: string;
 id?: string; scopes?: string[]; auth?: "oauth"|"api-key"|"bot"; enabled?: boolean;
 clientId?: string; tokenEndpoint?: string; redirectUri?: string; broker?: string; oauthFlow?:"device"|"pkce";
}
interface AccountData {version:2; active?:string; accounts:ConnectedAccount[]}
const key=(id:PluginId)=>`solar.connect.${id}.v2`;
let queue=Promise.resolve();
async function read(id:PluginId):Promise<AccountData>{
 const raw=await secretVault.get(key(id));
 if(raw){const data=JSON.parse(raw) as AccountData;if(data.version!==2||!Array.isArray(data.accounts))throw Error("Connexions incompatibles. Aucune donnée n’a été remplacée.");return data;}
 const legacy=await secretVault.get(`solar.connect.${id}.v1`);
 if(!legacy)return {version:2,accounts:[]};
 const account=JSON.parse(legacy) as ConnectedAccount;
 if(!account.accessToken||!account.identity)throw Error("Ancienne connexion invalide. Reconnecte le service.");
 return {version:2,active:"legacy",accounts:[{...account,id:"legacy",auth:"oauth",enabled:true}]};
}
export async function listAccounts(id:PluginId){await queue;return (await read(id)).accounts;}
export async function savedConnection(id:PluginId){await queue;const data=await read(id);return data.accounts.find(account=>account.id===data.active&&account.enabled!==false)??null;}
async function change(id:PluginId,fn:(data:AccountData)=>void){const owner=currentAccountScope();const operation=queue.then(async()=>{if(currentAccountScope()!==owner)throw Error("Compte Solar modifié.");const data=await read(id);fn(data);await secretVault.set(key(id),JSON.stringify(data));if(typeof window!=="undefined")window.dispatchEvent(new Event("solar-plugins-changed"));});queue=operation.catch(()=>{});await operation;}
export async function saveConnection(id:PluginId,value:ConnectedAccount){await change(id,data=>{const account={...value,id:value.id??crypto.randomUUID(),enabled:value.enabled??true};data.accounts=[...data.accounts.filter(item=>item.id!==account.id&&!(item.identity===account.identity&&item.auth===account.auth)),account];data.active=account.id;});}
export async function selectAccount(id:PluginId,accountId:string){await change(id,data=>{if(!data.accounts.some(item=>item.id===accountId))throw Error("Compte introuvable.");data.active=accountId;});}
export async function removeConnection(id:PluginId,accountId?:string){await change(id,data=>{const target=accountId??data.active;data.accounts=data.accounts.filter(item=>item.id!==target);if(data.active===target)data.active=data.accounts[0]?.id;});await secretVault.delete(`solar.connect.${id}.v1`);}
export async function uninstallPlugin(id:PluginId){await change(id,data=>{data.accounts=[];data.active=undefined;});await secretVault.delete(`solar.connect.${id}.v1`);}
