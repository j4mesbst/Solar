import type {ActivityPhase} from './activityPresentation';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AtlasHeader } from "./AtlasHeader";
import { AtlasSettingsDialog } from "./AtlasSettingsDialog";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import type { AtlasActivity } from "./connectors";
import { useAtlasMood } from "./useAtlasMood";
import type { AtlasEffortId, AtlasFile, AtlasMessage, AtlasModel, AtlasStatus } from "./types";
export type AtlasChatProps = {
  mascot?:import("../../services/solarAgentStore").MascotId;onChoice?:(messageId:string,optionId:string)=>void;
  responseDisplay?:"standard"|"messages";responseSound?:boolean;
  messages: AtlasMessage[]; status: AtlasStatus; draft: string; onDraftChange: (value: string) => void; onSend: () => void; onStop: () => void;
  models: AtlasModel[]; modelId: string; onModelChange: (id: string) => void; effort: AtlasEffortId; onEffortChange: (id: AtlasEffortId) => void;
  files: AtlasFile[]; onAddFiles: (files: File[]) => void; onRemoveFile: (id: string) => void;
  disabled?: boolean; initializing?: boolean; importing?: boolean; error?: string; completedRevision?: number; settingsCloseSignal?:number; settingsContent?: ReactNode; activity?: ReactNode; stamp?: string; onBack: () => void;
  suggestions?:ReactNode;appearance?: CSSProperties;
  header?:ReactNode;agentName?:string;directAttachments?:boolean;emptyContent?:ReactNode;showMascot?:boolean;toolActivity?:AtlasActivity;toolActivityPhase?:ActivityPhase;toolActivityTool?:string;
};
export function AtlasChat(props: AtlasChatProps) {
  const [open, setOpen] = useState(false);
  useEffect(()=>setOpen(false),[props.settingsCloseSignal]);
  const root = useRef<HTMLElement>(null),fileInput=useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const node = root.current, composer = node?.querySelector<HTMLElement>(".atlas-composer");
    if (!node || !composer) return;
    const observer = new ResizeObserver(() => node.style.setProperty("--atlas-composer-height", `${composer.offsetHeight}px`));
    observer.observe(composer); return () => observer.disconnect();
  }, []);
  const mood = useAtlasMood(props.status, props.completedRevision);
  return <section ref={root} className="atlas-root" style={props.appearance} aria-label={`Solar Agent — ${props.agentName??"Atlas"}`} aria-busy={props.initializing} onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={event => { if (event.defaultPrevented||!event.dataTransfer.types.includes("Files")) return; event.preventDefault(); props.onAddFiles(Array.from(event.dataTransfer.files)); }}>
    <MessageList mascot={props.mascot} agentName={props.agentName} onChoice={props.onChoice} disabled={props.disabled} responseDisplay={props.responseDisplay} responseSound={props.responseSound} messages={props.messages} status={props.status} stamp={props.stamp} toolActivity={props.toolActivity} toolActivityPhase={props.toolActivityPhase} toolActivityTool={props.toolActivityTool}>{!props.messages.length&&props.emptyContent}</MessageList>
    <div aria-hidden="true" className="atlas-fade atlas-fade-top"/><div aria-hidden="true" className="atlas-fade atlas-fade-bottom"/>
    {props.header??<AtlasHeader mood={mood} open={open} showMascot={props.showMascot} onToggle={() => setOpen(value => !value)}/>}
    {!props.header&&<AtlasSettingsDialog open={open} onClose={() => setOpen(false)} models={props.models} modelId={props.modelId} onModelChange={props.onModelChange} effort={props.effort} onEffortChange={props.onEffortChange} files={props.files} onAddFiles={props.onAddFiles} onRemoveFile={props.onRemoveFile} importing={props.importing}>{props.settingsContent}</AtlasSettingsDialog>}
    {props.error && <div className="atlas-feedback" role="alert">{props.error}</div>}
    {props.directAttachments&&<input ref={fileInput} type="file" multiple hidden aria-label="Joindre des fichiers" onChange={e=>{props.onAddFiles(Array.from(e.target.files??[]));e.target.value="";}}/>}
    <Composer reply={props.status==="idle"?props.messages.filter(m=>m.role==="atlas"&&!m.error&&!m.streaming&&m.text.trim()).slice(-1).map(m=>({id:m.id,text:m.text}))[0]:undefined} agentName={props.agentName} suggestions={props.suggestions} value={props.draft} onChange={props.onDraftChange} onSend={props.onSend} onOpenContext={() => props.directAttachments?fileInput.current?.click():setOpen(true)} files={props.files} onRemoveFile={props.onRemoveFile} busy={props.status !== "idle"} disabled={props.disabled} initializing={props.initializing} onStop={props.onStop} importing={props.importing}/>
  </section>;
}
