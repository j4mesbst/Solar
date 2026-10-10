import type { CSSProperties } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Button } from "./button";
export function SolarModeMenu({mode,onChange,style}:{style:CSSProperties;mode:"chat"|"work";onChange:(mode:"chat"|"work")=>void}) {
 return <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="ghost" className="solar-mode-trigger wordmark" aria-label="Choisir Solar ou Solar Code">{mode==="work"?"Solar Code":"Solar"}<ChevronDown size={17}/></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content style={style} className="solar-mode-menu" sideOffset={8} align="start"><DropdownMenu.RadioGroup value={mode} onValueChange={value=>onChange(value as "chat"|"work")}>{[{id:"chat",name:"Solar",description:"Créer, apprendre et explorer"},{id:"work",name:"Solar Code",description:"Développer, déboguer et livrer"}].map(item=><DropdownMenu.RadioItem key={item.id} value={item.id} className="solar-mode-item"><span><strong>{item.name}</strong><small>{item.description}</small></span><DropdownMenu.ItemIndicator><Check size={21}/></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>)}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}
