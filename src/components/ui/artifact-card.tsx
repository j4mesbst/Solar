import { useEffect,useState } from "react";
import { Palette, FileText, Presentation, Table2, Code2, LockKeyhole } from "lucide-react";
import type { Artifact } from "../../domain/extensions";
import { extensionStore } from "../../services/extensionStore";
import { Button } from "./button";
export function ArtifactCard({id,conversationId,current,onOpen}:{id:string;conversationId:string;current?:Artifact;onOpen:(a:Artifact)=>void}) {
 const [artifact,setArtifact]=useState<Artifact>();const [error,setError]=useState("");
 useEffect(()=>{let live=true;if(current?.id===id)setArtifact(current);else void extensionStore.listArtifacts(conversationId).then(items=>{if(live)setArtifact(items.find(a=>a.id===id));}).catch(()=>{if(live)setError("Artefact indisponible.");});return()=>{live=false;};},[id,conversationId,current]);
 const Icon=artifact?.kind==="document"?FileText:artifact?.kind==="slides"?Presentation:artifact?.kind==="table"?Table2:artifact?.kind==="code"?Code2:Palette;
 return <div className="artifact-card"><div className="artifact-card-icon"><Icon size={27}/></div><div className="artifact-card-copy"><strong>{artifact?.title??"Artefact"}</strong><small><LockKeyhole size={12}/>Enregistré localement · version {artifact?.revision??1}</small>{error&&<span role="alert">{error}</span>}</div><Button variant="secondary" disabled={!artifact} onClick={()=>artifact&&onOpen(artifact)}>Ouvrir<span className="sr-only"> l’artefact</span></Button></div>;
}
