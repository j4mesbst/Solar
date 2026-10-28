import { useEffect,useRef,useState } from "react";
import { X,ArrowRight,Eye,EyeOff,Server,Check } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "./button";
import { Input } from "./input";
import { connectMcp,listMcpServers,mcpFingerprint,saveMcpToken,closeMcp,type McpServer,type McpTool } from "../../services/mcpConnections";
export function McpConnectionDialog({onClose,initial,onConnected}:{onClose:()=>void;initial?:Partial<McpServer>;onConnected?:()=>void}){
 const [name,setName]=useState(initial?.name??""),[url,setUrl]=useState(initial?.url??""),[auth,setAuth]=useState<McpServer["auth"]>(initial?.auth??"none"),[token,setToken]=useState(""),[clientId,setClientId]=useState(initial?.clientId??""),[local,setLocal]=useState(initial?.local??false),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[tools,setTools]=useState<McpTool[]>([]);
 const controller=useRef<AbortController>(),id=useRef(initial?.id??crypto.randomUUID()),focus=useRef(document.activeElement as HTMLElement|null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const verify=async()=>{if(busy)return;setBusy(true);setError("");controller.current=new AbortController();try{
  const server:McpServer={id:id.current,name:name.trim(),url:url.trim(),auth,local,clientId:clientId.trim()||undefined,enabled:true};
  const previous=(await listMcpServers()).find(item=>item.id===server.id);if(previous&&mcpFingerprint(previous)!==mcpFingerprint(server))throw Error("Déconnecte d’abord ce serveur avant de modifier URL, authentification ou Client ID.");
  if(auth==="token"&&token)await saveMcpToken(server.id,token.trim());
  await closeMcp(server.id);const session=await connectMcp(server,controller.current.signal,true);setTools(session.tools);setToken("");onConnected?.();
 }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}};
 return <Dialog.Root open onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal container={document.querySelector(".shell")}><Dialog.Overlay className="plugin-modal-overlay"/><Dialog.Content className="plugin-connect-modal" onCloseAutoFocus={event=>{event.preventDefault();focus.current?.focus();}}>
  <button className="plugin-modal-close" aria-label="Fermer la connexion MCP" onClick={onClose}><X size={18}/></button>
  <div className="plugin-link-marks"><img src="/solar-icon.png" alt="Solar"/><ArrowRight/><Server size={44}/></div>
  <Dialog.Title>Connect MCP Server</Dialog.Title><Dialog.Description>Découvre et utilise les outils d’un serveur que tu autorises.</Dialog.Description>
  <div className="plugin-permission-note">Aucun accès automatique aux fichiers, au terminal ou aux secrets de ton Mac. Les outils MCP demandent une confirmation par appel.</div>
  <label>Nom du serveur<Input disabled={busy} value={name} onChange={event=>setName(event.target.value)} maxLength={100}/></label>
  <label>URL du serveur<Input disabled={busy} value={url} onChange={event=>{setUrl(event.target.value);setTools([]);}} placeholder="https://example.com/mcp"/></label>
  <label>Authentification<select disabled={busy} value={auth} onChange={event=>setAuth(event.target.value as McpServer["auth"])}><option value="none">Aucune</option><option value="oauth">OAuth officiel</option><option value="token">Token personnel</option></select></label>
  {auth==="oauth"&&<label>Client ID public (facultatif)<Input disabled={busy} value={clientId} onChange={event=>setClientId(event.target.value)} placeholder="Enregistrement dynamique si disponible"/></label>}
  {auth==="token"&&<label>Token<div className="plugin-key-field"><Input disabled={busy} type={show?"text":"password"} value={token} onChange={event=>setToken(event.target.value)} autoComplete="off"/><button aria-label={show?"Masquer le token":"Afficher le token"} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
  <label className="plugin-local-consent"><input type="checkbox" disabled={busy} checked={local} onChange={event=>setLocal(event.target.checked)}/>J’autorise ce serveur local loopback (application macOS).</label>
  {error&&<p role="alert" className="plugin-connect-error">{error}</p>}
  {tools.length>0&&<details open className="plugin-discovered-tools"><summary><Check size={14}/>{tools.length} outils réellement découverts</summary>{tools.map(tool=><p key={tool.name}><strong>{tool.name}</strong><span>{tool.description?.slice(0,200)}</span></p>)}</details>}
  <Button className="plugin-connect-primary" disabled={busy||!name.trim()||!url.trim()} onClick={()=>void verify()}>{busy?"Connexion et découverte…":"Verify & Connect"}</Button>
  {busy&&<Button variant="ghost" onClick={()=>controller.current?.abort()}>Annuler</Button>}
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
