import { useEffect, useState } from "react";
import { solarAgentStore, type AgentData } from "../../services/solarAgentStore";
import { Button } from "./button";
export function AgentNotebookPanel({agentId,revision=0,name="Atlas",teamMode=false}:{agentId:string;revision?:number;name?:string;teamMode?:boolean}) {
 const [data,setData]=useState<AgentData>(),[error,setError]=useState("");
 const refresh=()=>solarAgentStore.snapshot().then(setData).catch(()=>setError("Carnet indisponible."));
 useEffect(()=>{void refresh();},[agentId,revision]);
 const book=data?.notebooks?.[agentId];
 return <div className="agent-notebook"><p>{name} retient tes déclarations personnelles et le dernier sujet traité. Les faits sont reliés à leur message d’origine ; les contenus des mails ne sont pas ajoutés à cette mémoire.</p>
 <label><input type="checkbox" checked={data?.memorySettings?.enabled!==false} onChange={async e=>{try{setData(await solarAgentStore.saveMemorySettings({enabled:e.target.checked,cloud:data?.memorySettings?.cloud===true}));}catch{setError("Réglage non enregistré.");}}}/>Mémoriser les informations utiles{teamMode?" (tous les agents)":""}</label>
 <label><input type="checkbox" checked={data?.memorySettings?.cloud===true} onChange={async e=>{try{setData(await solarAgentStore.saveMemorySettings({enabled:data?.memorySettings?.enabled!==false,cloud:e.target.checked}));}catch{setError("Réglage non enregistré.");}}}/>{teamMode?"Autoriser cette mémoire sur Solar Cloud (tous les agents)":"Utiliser cette mémoire avec le modèle cloud choisi"}</label>
 <small>{book?.facts.length??0} faits · {book?.routines.length??0} habitudes en cours d’observation. Mémoire conservée sur cet appareil, par compte.</small>
 {book?.facts.map(f=><p key={f.slot}>{f.content}<small>{teamMode?"Mis à jour le ":`Source : ${f.messageId} · `}{new Date(f.updatedAt).toLocaleDateString("fr-FR")}</small></p>)}
 {book?.focus&&<p><strong>Dernier sujet</strong><br/>{book.focus.goal}</p>}
 {book?.routines.map(r=><p key={r.service}>{r.service=== "gmail"?"Gmail":"Outlook"} : lecture des derniers mails observée sur {r.days.length} jour{r.days.length>1?"s":""}.</p>)}
 <Button variant="outline" disabled={!book} onClick={async()=>{try{setData(await solarAgentStore.clearNotebook(agentId));}catch{setError("Le carnet n’a pas pu être effacé.");}}}>Effacer le carnet et les habitudes</Button>{error&&<p role="alert">{error}</p>}</div>;
}
