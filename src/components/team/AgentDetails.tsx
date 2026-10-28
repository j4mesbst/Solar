import {AgentComputer} from './AgentComputer';
import {useState} from 'react';
import {X} from 'lucide-react';
import {AgentMascot} from './AgentMascot';
import type {SolarAgent,TeamProfile} from '../../services/solarAgentStore';
import {accessModes} from '../ui/access-mode-select';
import {Check} from 'lucide-react';
import {AgentLibrary} from './AgentLibrary';

export function AgentDetails({agent,profile,onClose,onEdit,onAccess,onRun:_onRun}:{agent:SolarAgent;profile:TeamProfile;onClose:()=>void;onEdit:()=>void;onAccess:(mode:NonNullable<SolarAgent['accessMode']>)=>void;onRun:(text:string)=>void}){
 const [tab,setTab]=useState('details');
 return <aside className="messenger-details" aria-label={`Détails de ${agent.name}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <button autoFocus className="team-icon-button messenger-details-close" aria-label="Fermer les détails" onClick={onClose}><X size={18}/></button>
  <header><AgentMascot color={profile.color} kind={profile.mascot} size={64} active/><h2>{agent.name}</h2><button className="messenger-text-button" onClick={onEdit}>Modifier l’agent</button></header>
  <div className="messenger-details-tabs" role="tablist" aria-label="Informations de l’agent">{[['details','Détails'],['library','Bibliothèque'],['computer','Ordinateur']].map(([id,label],index,all)=><button key={id} id={`agent-tab-${id}`} role="tab" aria-selected={tab===id} tabIndex={tab===id?0:-1} aria-controls={`agent-panel-${id}`} onClick={()=>setTab(id)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?all.length-1:(index+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;setTab(all[next][0]);document.getElementById(`agent-tab-${all[next][0]}`)?.focus();}}>{label}</button>)}</div>
  <section role="tabpanel" id={`agent-panel-${tab}`} aria-labelledby={`agent-tab-${tab}`} className="messenger-details-content">
   {tab==='details'?<div className="agent-permissions"><h3>Autorisations</h3><div role="group" aria-label={`Autorisations de ${agent.name}`}>{accessModes.map(mode=><button key={mode.id} aria-pressed={(agent.accessMode??'standard')===mode.id} onClick={()=>onAccess(mode.id)}><span>{mode.label}</span>{(agent.accessMode??'standard')===mode.id&&<Check size={16}/>}</button>)}</div></div>:tab==='library'?<AgentLibrary agentId={agent.id} folders={profile.libraryFolders??[]}/>:<AgentComputer/>}
  </section>
 </aside>;
}
