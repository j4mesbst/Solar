import { useEffect,useState } from "react";
import { Palette, FileText, Presentation, Table2, Code2, LockKeyhole, ArrowRight } from "lucide-react";
import type { Artifact } from "../../domain/extensions";
import { extensionStore } from "../../services/extensionStore";
import { Button } from "./button";
export function ArtifactCard({id,conversationId,current,onOpen,busy=false}:{id:string;conversationId:string;current?:Artifact;onOpen:(a:Artifact)=>void;busy?:boolean}) {
 const [artifact,setArtifact]=useState<Artifact>();const [error,setError]=useState("");
 useEffect(()=>{let live=true;if(current?.id===id)setArtifact(current);else void extensionStore.listArtifacts(conversationId).then(items=>{if(live)setArtifact(items.find(a=>a.id===id));}).catch(()=>{if(live)setError("Artefact indisponible.");});return()=>{live=false;};},[id,conversationId,current]);
 const Icon=artifact?.kind==="document"?FileText:artifact?.kind==="slides"?Presentation:artifact?.kind==="table"?Table2:artifact?.kind==="code"?Code2:Palette;
 const kind=artifact?.kind;
 const subtitle=kind==="slides"?`Présentation · ${artifact?.slides?.length??0} diapos`:kind==="code"?`Code · ${artifact?.language??"source"}`:kind==="document"?"Document":kind==="table"?"Tableau":kind==="diagram"?"Schéma":"Création";
 return <button className={`artifact-card ${busy?"is-generating":""}`} type="button" disabled={!artifact} onClick={()=>artifact&&onOpen(artifact)} aria-label={`Ouvrir ${artifact?.title??"l’artefact"}`}><span className={`artifact-card-icon artifact-icon-${kind??"pending"}`} aria-hidden="true"><Icon size={21}/><i/><i/></span><span className="artifact-card-copy"><strong>{artifact?.title??"Création en cours"}</strong><small>{busy?"Création en cours…":subtitle}{artifact&&<><span aria-hidden="true"> · </span><LockKeyhole size={11}/><span>v{artifact.revision}</span></>}</small>{error&&<span role="alert">{error}</span>}</span><ArrowRight className="artifact-card-arrow" size={17} aria-hidden="true"/></button>;
}
