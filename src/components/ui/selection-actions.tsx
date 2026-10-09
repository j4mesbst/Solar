import { useState } from "react";
import { X } from "lucide-react";
import { MarkdownMessage } from "./markdown-message";
import type { TextAction } from "../../hooks/useTextActions";
export function SelectionToolbar({selection,disabled,onAction}:{selection:{x:number;y:number};disabled:boolean;onAction:(action:TextAction)=>void}){
 return <div className="selection-toolbar" role="toolbar" aria-label="Actions sur le passage sélectionné" style={{left:selection.x,top:selection.y}} onMouseDown={event=>event.preventDefault()}>{(["Simplifier","Développer","Corriger","Reformuler","Résumer"] as const).map(action=><button key={action} disabled={disabled} title={disabled?"Attends la fin de la génération en cours.":action} onClick={()=>onAction(action)}>{action}</button>)}</div>;
}
export function SelectionResult({result,busy,onStop,onClose,onInsert}:{result:{text:string;action:TextAction;error?:string};busy:boolean;onStop:()=>void;onClose:()=>void;onInsert:(text:string)=>void}){
 const [copyState,setCopyState]=useState("");
 return <section className="selection-result" aria-label={`Passage : ${result.action}`}><header><span>{result.action}{busy?" · en cours…":""}</span><button className="icon-button" onClick={onClose} aria-label="Fermer le résultat"><X size={15}/></button></header><div className="message-content"><MarkdownMessage content={result.text}/></div>{result.error&&<p className="message-error" role="alert">{result.error}</p>}<footer>{busy?<button className="small-button" onClick={onStop}>Arrêter</button>:<><button className="small-button" disabled={!result.text} onClick={async()=>{try{await navigator.clipboard.writeText(result.text);setCopyState("Copié");}catch{setCopyState("Copie indisponible");}}}>{copyState||"Copier"}</button><button className="small-button" disabled={!result.text} onClick={()=>onInsert(result.text)}>Insérer dans le champ</button></>}</footer></section>;
}
