import {Check,Monitor,Moon,Sun,Volume2} from 'lucide-react';
import {useRef,useState} from 'react';
import type {AppSettings} from '../../domain/types';
export function AccountPreferences({settings,save}:{settings:AppSettings;save:(value:AppSettings)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const locked=useRef(false);
 const update=async(patch:Partial<AppSettings>)=>{if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await save({...settings,...patch});}catch{setError('Impossible d’enregistrer ce choix. Réessaie.');}finally{locked.current=false;setBusy(false);}};
 return <div className="account-preferences">
  <section aria-labelledby="account-theme"><h2 id="account-theme">Apparence</h2><p>Un espace clair, sombre ou adapté à ta journée.</p><div className="account-theme-choices">{([{id:'light',name:'Clair',Icon:Sun},{id:'dark',name:'Sombre',Icon:Moon},{id:'system',name:'Automatique',Icon:Monitor}] as const).map(({id,name,Icon})=><button key={id} className={`account-theme-choice ${id}`} aria-pressed={settings.theme===id} disabled={busy} onClick={()=>void update({theme:id})}><span className="account-theme-mini" aria-hidden="true"><i/><span><i/><i/><i/></span></span><span><Icon size={14}/>{name}{settings.theme===id&&<Check size={13}/>}</span></button>)}</div></section>
  <label className="account-response-sound"><Volume2 size={15}/><span>Son à réception</span><input type="checkbox" checked={settings.responseSound??false} disabled={busy} onChange={e=>void update({responseSound:e.target.checked})}/></label>
  {error&&<p role="alert" className="team-error">{error}</p>}
 </div>;
}
