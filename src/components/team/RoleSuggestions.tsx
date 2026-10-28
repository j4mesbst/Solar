import {useEffect,useState,type CSSProperties} from 'react';
import {PluginLogo} from '../ui/plugin-logo';
import {localRoleIdeas,type RoleIdea} from '../../services/agentPresentation';
import {Globe} from 'lucide-react';
import {prepareRoleSuggestions} from '../../services/teamSuggestions';
import type {TeamProfile} from '../../services/solarAgentStore';
import type {Model,Provider} from '../../domain/types';
export function RoleSuggestions({profile,provider,model,disabled,onSelect,onPrepared}:{profile:TeamProfile;provider?:Provider;model?:Model;disabled?:boolean;onSelect:(suggestion:RoleIdea)=>void;onPrepared:()=>Promise<void>}){
 const [preparing,setPreparing]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!profile.role||!provider||!model||(!retry&&profile.suggestions?.role===profile.role))return;let live=true;setPreparing(true);void prepareRoleSuggestions(profile,provider,model,!!retry).then(()=>onPrepared()).catch(()=>{}).finally(()=>{if(live)setPreparing(false);});return()=>{live=false;};},[profile.agentId,profile.role,provider?.id,model?.id,retry]);
 if(!profile.role)return null;
 const fallback=localRoleIdeas(profile);
 if(profile.suggestions?.status!=='ready'||profile.suggestions.role!==profile.role)return <div className="team-role-fallback"><div className="team-role-suggestions" aria-label="Suggestions pour ce rôle">{fallback.map((item,index)=><button key={item.id} type="button" style={{'--suggestion-index':index} as CSSProperties} disabled={disabled} onClick={()=>onSelect(item)}>{item.service?<PluginLogo id={item.service}/>:<Globe size={19}/>}<span>{item.text}</span></button>)}</div>{!preparing&&(profile.suggestions?.status==='error')&&<button className="team-suggestions-retry" disabled={!provider||!model} onClick={()=>setRetry(n=>n+1)}>Réessayer</button>}</div>;
 return <div className="team-role-suggestions" aria-label="Suggestions pour ce rôle">{profile.suggestions.items.map((item,index)=><button key={item.id+profile.role} type="button" style={{'--suggestion-index':index} as CSSProperties} disabled={disabled} onClick={()=>onSelect(item as RoleIdea)}><PluginLogo id={item.service}/><span>{item.text}</span></button>)}</div>;
}
