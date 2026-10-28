import { PluginLogo } from "../ui/plugin-logo";
import type { AtlasSuggestion } from "../../services/atlasSuggestions";
export function AtlasSuggestions({items,disabled,onSelect}:{items:AtlasSuggestion[];disabled?:boolean;onSelect:(text:string)=>void}){
 if(items.length!==3)return null;
 return <div className="atlas-suggestions" aria-label="Suggestions pour Atlas">{items.map(item=><button key={item.id} type="button" disabled={disabled} onClick={()=>onSelect(item.text)}><PluginLogo id={item.service}/><span>{item.text}</span></button>)}</div>;
}
