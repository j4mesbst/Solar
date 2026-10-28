import {useEffect,useRef,useState} from "react";
import {Dialog} from "radix-ui";
import {X,ArrowRight,Eye,EyeOff,Check} from "lucide-react";
import {Button} from "./button";
import {Input} from "./input";
import {pluginInfo} from "../../services/pluginCatalog";
import {disconnectConnection,connectApiKey,connectOAuth,connectGitHub,oauthConfiguration} from "../../services/solarConnect";
import {listAccounts,savedConnection,selectAccount,type ConnectedAccount} from "../../services/pluginAccounts";
import {pluginIdentity,listPluginItems,readPluginItem,type PluginItem} from "../../services/pluginConnections";
import {PluginLogo} from "./plugin-logo";
export function PluginConnectionDialog({id,onClose,onImport,canImport=true}:{id:string;onClose:()=>void;onImport:(text:string)=>Promise<void>;canImport?:boolean}){
 const info=pluginInfo(id);
 const [identity,setIdentity]=useState(""),[accounts,setAccounts]=useState<ConnectedAccount[]>([]),[account,setAccount]=useState<ConnectedAccount|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[status,setStatus]=useState("Non connecté");
 const [key,setKey]=useState(""),[show,setShow]=useState(false),[deviceCode,setDeviceCode]=useState(""),[query,setQuery]=useState(""),[items,setItems]=useState<PluginItem[]>([]);
 const controller=useRef<AbortController>(),focus=useRef(document.activeElement as HTMLElement|null),mounted=useRef(true);
 const reload=async()=>{if(!info)return;const values=await listAccounts(info.id),saved=await savedConnection(info.id);if(mounted.current){setAccounts(values);setAccount(saved);}};
 useEffect(()=>{mounted.current=true;const abort=new AbortController();void(async()=>{try{await reload();if(info&&await savedConnection(info.id)){const value=await pluginIdentity(info.id,undefined,undefined,abort.signal);if(mounted.current){setIdentity(value);setStatus("Connecté et vérifié");}}}catch(reason){if(mounted.current&&!abort.signal.aborted){setStatus("Connexion à vérifier");setError(reason instanceof Error?reason.message:"Impossible de lire la connexion.");}}finally{if(mounted.current)setLoading(false);}})();return()=>{mounted.current=false;abort.abort();controller.current?.abort();};},[id]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('solar-connection-state',{detail:{service:id,state:busy?'pending':error?'error':'idle',error}}));},[id,busy,error]);
 const run=async(action:(signal:AbortSignal)=>Promise<void>)=>{if(busy)return;setBusy(true);setError("");controller.current=new AbortController();try{await action(controller.current.signal);if(mounted.current)await reload();}catch(reason){if(mounted.current){setError(reason instanceof Error?reason.message:"Connexion impossible.");setStatus("Connexion à vérifier");}}finally{if(mounted.current){setBusy(false);setDeviceCode("");}}};
 const connect=()=>void run(async signal=>{if(!info)return;setStatus("Connexion en cours");const value=info.connection==="key"?await connectApiKey(info.id,key,signal):info.id==="github"?await connectGitHub(code=>{if(mounted.current)setDeviceCode(code);},signal):await connectOAuth(info.id,signal);signal.throwIfAborted();if(mounted.current){setIdentity(value);setStatus("Connecté et vérifié");setKey("");}});
 const configuration=info?oauthConfiguration(info.id):undefined;
 if(!info)return null;
 return <Dialog.Root open onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal container={document.querySelector(".solar-setup[open]")??document.querySelector(".apple-settings-window")??document.querySelector(".shell")}><Dialog.Overlay className="plugin-modal-overlay"/><Dialog.Content className="plugin-connect-modal" onEscapeKeyDown={event=>{event.preventDefault();event.stopPropagation();onClose();}} onCloseAutoFocus={event=>{event.preventDefault();focus.current?.focus();}}>
  <div className="plugin-connect-banner"><button className="plugin-modal-close" aria-label="Fermer la connexion" onClick={onClose}><X size={18}/></button>
  <div className="plugin-link-marks"><img src="/solar-icon.png" alt="Solar"/><ArrowRight className={busy?"plugin-link-active":""}/><PluginLogo id={info.id}/></div></div>
  <div className="plugin-connect-body">
  <Dialog.Title>Connecter {info.name}</Dialog.Title><Dialog.Description>Votre compte, directement dans Solar.</Dialog.Description>
  <div className="plugin-account-status" role="status"><span data-connected={Boolean(identity)}><Check size={14}/>{loading?"Vérification de la connexion…":status}</span>{identity&&<strong>{identity}</strong>}</div>
  <section className="plugin-about"><header><div><PluginLogo id={info.id}/><div><strong>{info.name}</strong><span>Connecteur pour Solar</span></div></div><span>{info.connection==="direct"?"Connexion directe":"Clé API"}</span></header><h3>À propos</h3><p>{info.capabilities.replaceAll("après confirmation","selon le mode d’accès choisi")}</p><h3>Fonctionnalités</h3><div className="plugin-capability-tags"><span>Solar Chat</span><span>Solar Agent</span><span>{info.connection==="direct"?"Compte personnel":"Accès API"}</span></div><small>Les accès respectent les permissions de ton compte et le mode d’autorisation choisi dans Solar.</small></section>
  {accounts.length>1&&<label>Compte utilisé<select value={account?.id??""} disabled={busy} onChange={event=>void run(async signal=>{await selectAccount(info.id,event.target.value);setIdentity("");const value=await pluginIdentity(info.id,undefined,undefined,signal);setIdentity(value);setStatus("Connecté et vérifié");})}>{accounts.map(item=><option key={item.id} value={item.id}>{item.identity}</option>)}</select></label>}
  {account&&<div className="plugin-account-actions"><Button variant="ghost" disabled={busy} onClick={()=>void run(async signal=>{const value=await disconnectConnection(info.id,signal);setIdentity("");setStatus(value);setItems([]);})}>Déconnecter ce compte</Button></div>}
  {info.connection==="key"&&<><label>{info.tokenLabel}<div className="plugin-key-field"><Input aria-label="Clé API" disabled={busy} autoComplete="off" spellCheck={false} type={show?"text":"password"} value={key} onChange={event=>setKey(event.target.value)}/><button aria-label={show?"Masquer la clé":"Afficher la clé"} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><p className="plugin-connect-help">Vérifiée auprès du service, puis conservée dans le Trousseau macOS.</p></>}
  {info.connection==="direct"&&!configuration?.ready&&<p className="plugin-connect-help">{configuration?.reason}</p>}
  <Button className="plugin-connect-primary" disabled={loading||busy||(info.connection==="direct"?!configuration?.ready:!key.trim())} onClick={connect}>{busy?"Connexion en cours…":info.connection==="direct"?`Continue with ${info.name}`:"Vérifier et connecter"}</Button>
  {deviceCode&&<div className="plugin-device-code" role="status"><span>Code à saisir dans le navigateur GitHub</span><strong>{deviceCode}</strong></div>}
  {error&&<p role="alert" className="plugin-connect-error">{error}</p>}
  {busy&&<Button variant="ghost" onClick={()=>controller.current?.abort()}>Annuler</Button>}
  {canImport&&identity&&["github","gmail"].includes(info.id)&&<details className="plugin-source-import"><summary>Importer une source dans le chat</summary><form onSubmit={event=>{event.preventDefault();void run(async signal=>setItems(await listPluginItems(info.id,query,signal)));}}><Input aria-label="Rechercher une source" value={query} onChange={event=>setQuery(event.target.value)}/><Button disabled={busy} type="submit">Rechercher</Button></form>{items.map(item=><article key={item.id}><span>{item.title}</span><Button variant="outline" disabled={busy} onClick={()=>void run(async signal=>{await onImport(await readPluginItem(info.id,item,signal));onClose();})}>Ajouter au chat</Button></article>)}</details>}
 </div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
