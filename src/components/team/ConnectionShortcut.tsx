import {useEffect,useState} from 'react';
import {pluginCatalog,type PluginId} from '../../services/pluginCatalog';
import {savedConnection} from '../../services/pluginAccounts';
import {PluginLogo} from '../ui/plugin-logo';
import {BlocksIcon} from '../ui/animated-account-icons';
export function ConnectionShortcut({onClick}:{onClick:()=>void}){
 const[ids,setIds]=useState<PluginId[]>([]);
 useEffect(()=>{let live=true;const load=()=>void Promise.all(pluginCatalog.map(async p=>await savedConnection(p.id)?p.id:null)).then(rows=>{if(live)setIds(rows.filter((id):id is PluginId=>!!id).slice(0,3));}).catch(()=>{if(live)setIds([]);});load();window.addEventListener('solar-plugins-changed',load);return()=>{live=false;window.removeEventListener('solar-plugins-changed',load);};},[]);
 return <button className="messenger-connect-pill" aria-label="Connecter des applications" title="Connecter des applications" onClick={onClick}><span>Connecter des applications</span><span className="messenger-connected-logos" aria-hidden>{ids.length?ids.map(id=><PluginLogo key={id} id={id}/>):<BlocksIcon size={18}/>}</span></button>;
}
