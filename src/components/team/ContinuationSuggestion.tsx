import {ArrowUpRight,Globe} from 'lucide-react';
import {PluginLogo} from '../ui/plugin-logo';
import {dismissContinuation,type ContinuationSuggestion as Suggestion} from '../../services/continuationSuggestions';
export function ContinuationSuggestion({suggestion,disabled,onSelect}:{suggestion?:Suggestion;disabled?:boolean;onSelect:(suggestion:Suggestion)=>void}){
 if(!suggestion)return null;
 return <div className="team-continuation" aria-label="Suggestion de reprise"><button type="button" disabled={disabled} title={suggestion.reason} onClick={()=>{dismissContinuation(suggestion.id);onSelect(suggestion);}}>{suggestion.service?<PluginLogo id={suggestion.service}/>:<Globe size={19}/>}<span>{suggestion.text}</span><ArrowUpRight size={14}/></button></div>;
}
