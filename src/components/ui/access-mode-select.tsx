import { useRef } from "react";
import { Select } from "radix-ui";
import { Check, ChevronDown, Shield } from "lucide-react";
import type { AgentAccessMode } from "../../domain/types";
export const accessModes=[{id:"read-only",label:"Lecture seule",hint:"Consulter sans modifier"},{id:"standard",label:"Accès standard",hint:"Demander avant les actions sensibles"},{id:"full",label:"Accès complet",hint:"Agir sans confirmation supplémentaire"}] as const;
export function AccessModeSelect({value,onChange,label="Autorisations de Solar Chat"}:{label?:string;value:AgentAccessMode;onChange:(value:AgentAccessMode)=>void}){
 const trigger=useRef<HTMLButtonElement>(null);
 return <Select.Root value={value} onValueChange={v=>onChange(v as AgentAccessMode)}><Select.Trigger ref={trigger} className="chat-access-trigger" aria-label={label}><Shield size={17}/><Select.Value/><Select.Icon><ChevronDown size={13}/></Select.Icon></Select.Trigger><Select.Portal container={document.querySelector<HTMLElement>(".shell")??undefined}><Select.Content position="popper" side="top" align="start" sideOffset={10} className="chat-access-menu" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus();}}><Select.Viewport>{accessModes.map(mode=><Select.Item className="chat-access-option" key={mode.id} value={mode.id}><div><Select.ItemText>{mode.label}</Select.ItemText><small>{mode.hint}</small></div><Select.ItemIndicator><Check size={16}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root>;
}
