import { Select } from "radix-ui";
import { useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
export type AtlasOption = { id: string; label: string; hint?: string };
export function AtlasSelect({ label, value, options, onChange }: { label: string; value: string; options: AtlasOption[]; onChange: (id: string) => void }) {
  const trigger=useRef<HTMLButtonElement>(null);
  const current = options.find(option => option.id === value);
  return <label className="atlas-select-label"><span>{label}</span><Select.Root value={current?.id ?? ""} onValueChange={onChange} disabled={!options.length}>
    <Select.Trigger ref={trigger} aria-label={label} className="atlas-field atlas-select-trigger"><span>{current?.label ?? "Aucun modèle disponible"}</span><Select.Icon><ChevronDown size={16}/></Select.Icon></Select.Trigger>
    <Select.Portal container={trigger.current?.closest("[role=dialog]")??document.querySelector(".atlas-root")}><Select.Content position="popper" sideOffset={7} className="atlas-menu atlas-select-menu" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus();}}><Select.Viewport>{options.map(option => <Select.Item key={option.id} value={option.id} className="atlas-opt atlas-select-option"><Select.ItemText>{option.label}</Select.ItemText>{option.hint && <small>{option.hint}</small>}<Select.ItemIndicator><Check size={17}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
  </Select.Root></label>;
}
