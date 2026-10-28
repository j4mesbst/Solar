import {ArrowUpRight,Layers3,Link2} from 'lucide-react';
import type {SetupProposal} from '../../services/setupTypes';
import {pluginInfo} from '../../services/pluginCatalog';

/** A view of the actual proposal, never a simulated agent conversation or task. */
export function SetupShowcase({step,proposal,connections,managerName}:{step:number;proposal?:SetupProposal;connections:Record<string,string>;managerName?:string}){
 const name=managerName??proposal?.manager.name??'Atlas';
 const services=[...new Set(proposal?.agents.flatMap(a=>a.services)??[])];
 return <aside className={`setup-showcase setup-showcase-step-${step}`} aria-label={proposal?'Aperçu de ton équipe proposée':'Une nouvelle façon de travailler'}>
  <img className="setup-landscape" src="/setup/field-morning.jpg" alt=""/>
  {proposal?<div className="setup-team-window">
   <div className="setup-window-bar"><span className="setup-window-dots" aria-hidden="true"><i/><i/><i/></span><span>Ton équipe Solar</span><Layers3 size={13}/></div>
   <div className="setup-team-window-body"><p className="setup-preview-caption">ÉQUIPE PROPOSÉE</p>
    <div className="setup-preview-manager"><span className="setup-monogram">{name.slice(0,1)}</span><div><strong>{name}</strong><small>Manager · coordination</small></div><Layers3 size={14}/></div>
    <div className="setup-preview-branches" aria-hidden="true"/>
    <div className="setup-preview-agents">{proposal.agents.map(a=><div key={a.key}><span className="setup-monogram">{a.name.slice(0,1)}</span><strong>{a.name}</strong><p>{a.goal}</p></div>)}</div>
    <div className="setup-preview-tools"><Link2 size={13}/><span>{services.length?`${services.length} connexion${services.length>1?'s':''} utile${services.length>1?'s':''}`:'Aucune connexion nécessaire'}</span><div>{services.slice(0,5).map(id=><img key={id} src={`/plugin-icons/${pluginInfo(id)?.icon??id}.svg`} alt={pluginInfo(id)?.name??id}/>)}</div></div>
    {step===4&&<p className="setup-preview-note">{services.some(id=>!connections[id])?'Relie les outils de ton choix pour donner du contexte à ton équipe.':'Ton équipe peut poursuivre la configuration.'}</p>}
   </div>
  </div>:<div className="setup-feature-sheet"><div className="setup-feature-sheet-top"><span>Solar</span><ArrowUpRight size={14}/></div><span className="setup-feature-rule"/><p>Du temps pour<br/>ce qui compte.</p><small>Une équipe composée<br/>à partir de ton quotidien.</small></div>}
  <div className="setup-landscape-caption"><span>Un peu moins de routine.</span><span>Un peu plus d’espace.</span></div>
 </aside>;
}
