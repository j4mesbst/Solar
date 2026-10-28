import { Dialog } from "radix-ui";
import { X, Upload, FileText } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { AtlasMascot } from "./AtlasMascot";
import { AtlasSelect } from "./AtlasSelect";
import { ATLAS_EFFORTS, type AtlasEffortId, type AtlasFile, type AtlasModel } from "./types";

type Props = { open: boolean; onClose: () => void; models: AtlasModel[]; modelId: string; onModelChange: (id: string) => void; effort: AtlasEffortId; onEffortChange: (id: AtlasEffortId) => void; files: AtlasFile[]; onAddFiles: (files: File[]) => void; onRemoveFile: (id: string) => void; importing?: boolean; children?: ReactNode };
export function AtlasSettingsDialog(props: Props) {
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(()=>{if(!props.open)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!document.querySelector('[role="listbox"][data-state="open"]')){event.preventDefault();event.stopPropagation();props.onClose();}};document.addEventListener("keydown",escape,true);return()=>document.removeEventListener("keydown",escape,true);},[props.open,props.onClose]);
  return <Dialog.Root open={props.open} onOpenChange={open => { if (!open) props.onClose(); }}><Dialog.Portal container={document.querySelector(".atlas-root")}>
    <Dialog.Overlay className="atlas-settings-overlay"/>
    <Dialog.Content className="atlas-win atlas-window atlas-settings-window" onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
      <div className="atlas-settings-heading"><AtlasMascot size={42} animated={false}/><div><Dialog.Title>Atlas</Dialog.Title><Dialog.Description>Ton agent personnel</Dialog.Description></div><Dialog.Close className="atlas-soft atlas-close" aria-label="Fermer les réglages d’Atlas"><X size={15}/></Dialog.Close></div>
      <AtlasSelect label="Modèle" value={props.modelId} options={props.models.map(model => ({ id: model.id, label: model.name, hint: model.where }))} onChange={props.onModelChange}/>
      <AtlasSelect label="Niveau d’effort" value={props.effort} options={ATLAS_EFFORTS.map(effort => ({ id: effort.id, label: effort.label }))} onChange={id => props.onEffortChange(id as AtlasEffortId)}/>
      <div className="atlas-context"><span>Contexte</span><label className="atlas-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); props.onAddFiles(Array.from(event.dataTransfer.files)); }}>
        <Upload size={28}/><strong>{props.importing ? "Lecture des fichiers…" : "Glisse des fichiers ici"}</strong><span>Dépose un fichier qui décrit la tâche, ou décris-la directement dans le champ de texte.</span>
        <input type="file" multiple aria-label="Ajouter des fichiers de contexte" disabled={props.importing} accept="image/png,image/jpeg,image/webp,.pdf,.docx,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.log,.yaml,.yml,.xml,.sh,.rs,.sql" onChange={event => { props.onAddFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }}/>
      </label><div className="atlas-file-list">{props.files.map(file => <div className="atlas-file-chip" key={file.id}><FileText size={14}/><span>{file.name}</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => props.onRemoveFile(file.id)}><X size={12}/></button></div>)}</div></div>
      {props.children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
