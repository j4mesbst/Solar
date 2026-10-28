import {VoiceControl} from '../voice/VoiceControl';
import { ArrowUp, FileText, Mic, Plus, Square, X } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { AtlasFile } from "./types";
type Props = { reply?:{id:string;text:string}; agentName?:string; suggestions?:ReactNode;value: string; onChange: (value: string) => void; onSend: () => void; onOpenContext: () => void; files: AtlasFile[]; onRemoveFile: (id: string) => void; busy: boolean; disabled?: boolean; initializing?: boolean; onStop: () => void; importing?: boolean };
export function Composer(props: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const node = textarea.current; if (node) { node.style.height = "auto"; node.style.height = `${Math.min(144, node.scrollHeight)}px`; } }, [props.value]);
  const has = Boolean(props.value.trim() || props.files.length);
  return <div className="atlas-composer"><div className="atlas-composer-inner">{props.suggestions}
    {props.files.length > 0 && <div className="atlas-composer-files">{props.files.map(file => <span key={file.id} className="atlas-glass atlas-file-chip"><FileText size={13}/><span>{file.name}</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => props.onRemoveFile(file.id)}><X size={12}/></button></span>)}</div>}
    <div className="atlas-composer-row"><button type="button" aria-label="Ajouter du contexte" onClick={props.onOpenContext} className="atlas-glass atlas-press atlas-context-button"><Plus size={22}/></button>
      <div className="atlas-glass atlas-capsule"><textarea ref={textarea} rows={1} readOnly={props.initializing} aria-busy={props.initializing} aria-label={`Message à ${props.agentName??"Atlas"}`} placeholder={props.busy ? "Prépare ton prochain message…" : `Décris ta tâche à ${props.agentName??"Atlas"}`} value={props.value} onChange={event => props.onChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (has && !props.busy && !props.disabled && !props.importing) props.onSend(); } }}/>
      <VoiceControl hidePlayback reply={props.reply} disabled={props.disabled||props.busy||props.importing||props.initializing} onText={text=>props.onChange(`${props.value}${props.value?" ":""}${text}`)}/>{props.busy ? <button type="button" aria-label={`Arrêter ${props.agentName??"Atlas"}`} onClick={props.onStop} className="atlas-blue atlas-send"><Square size={14} fill="currentColor"/></button> : has ? <button type="button" aria-label={`Envoyer à ${props.agentName??"Atlas"}`} disabled={props.disabled || props.importing} onClick={props.onSend} className="atlas-blue atlas-send"><ArrowUp size={19}/></button> : null}
      </div></div>
    {props.importing && <span className="atlas-composer-note" role="status">Lecture des fichiers…</span>}
  </div></div>;
}
