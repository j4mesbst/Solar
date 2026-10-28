import {useEffect,useState} from 'react';
import {Check,Cloud,KeyRound,Monitor} from 'lucide-react';
import {solarStore} from '../../services/store';
import {solarAgentStore} from '../../services/solarAgentStore';
import {secretVault} from '../../services/nativeVault';
import {refreshOllama} from '../../services/ollama';
import {providerApi} from '../../services/providerApi';
import {teamCloud} from '../../services/teamCloud';
import {isSolarCloudProvider} from '../../services/solarCloud';
import {scopedKey} from '../../services/accountScope';
import type {Model,Provider} from '../../domain/types';

export function TeamModelsPage({onChange}:{onChange:()=>Promise<void>}){
 const[models,setModels]=useState<Model[]>([]),[providers,setProviders]=useState<Provider[]>([]);
 const[key,setKey]=useState(''),[busy,setBusy]=useState(false),[editingKey,setEditingKey]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const refresh=async()=>{const[p,m,s]=await Promise.all([solarStore.listProviders(),solarStore.listModels(),solarStore.getSettings()]);setProviders(p);setModels(m);setSelected(teamCloud(p,m,s.agent?.defaultModelId)?.model.id??'');};
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[]);
 const task=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn();await refresh();await onChange();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const choose=async(m:Model)=>{const settings=await solarStore.getSettings();await solarStore.saveSettings({...settings,agent:{...settings.agent,defaultModelId:m.id}});localStorage.setItem(scopedKey('solar.team.model'),m.id);await solarAgentStore.useTeamModel(m.providerId,m.id);setSelected(m.id);};
 const available=(test:(p:Provider)=>boolean)=>models.filter(m=>m.enabled&&m.available!==false&&providers.some(p=>p.enabled&&p.id===m.providerId&&test(p)));
 const local=available(p=>p.protocol==='ollama'),openai=available(p=>p.baseUrl.replace(/\/$/,'')==='https://api.openai.com/v1'),cloud=available(isSolarCloudProvider);
 const current=models.find(m=>m.id===selected),currentProvider=providers.find(p=>p.id===current?.providerId);
 const detect=()=>task(async()=>{await refreshOllama();const[p,m,s]=await Promise.all([solarStore.listProviders(),solarStore.listModels(),solarStore.getSettings()]);const locals=m.filter(m=>m.enabled&&m.available!==false&&p.some(p=>p.enabled&&p.id===m.providerId&&p.protocol==='ollama'));const best=locals.find(m=>m.id===s.agent?.defaultModelId)??locals.find(m=>m.providerModelId==='ornith-1.5:9b')??locals.find(m=>/qwen/i.test(m.providerModelId??m.name))??locals[0];if(!best)throw Error('Lance Ollama avec un modèle installé, puis réessaie.');await choose(best);});
 const connect=()=>task(async()=>{if(!key.trim())return;const p:Provider={id:'solar:openai',name:'OpenAI',baseUrl:'https://api.openai.com/v1',protocol:'openai-compatible',secretRef:'provider:solar:openai',enabled:true,connectionState:'unknown'};const vault={...secretVault,get:async(ref:string)=>ref===p.secretRef?key.trim():secretVault.get(ref)};const discovered=await providerApi.discoverModels(p,vault);const m=['gpt-4.1-mini','gpt-4o-mini','gpt-4.1','gpt-4o'].map(id=>discovered.find(m=>m.providerModelId===id)).find(Boolean);if(!m)throw Error('Aucun modèle de conversation compatible accessible avec cette clé.');await secretVault.set(p.secretRef,key.trim());await solarStore.saveProvider({...p,connectionState:'connected'});await solarStore.saveModel(m);await choose(m);setKey('');setEditingKey(false);});
 return <section className="team-models-page"><h1>Modèles</h1><div className="model-choice-grid">
 <article className="model-choice" data-selected={local.some(m=>m.id===selected)}><Monitor size={26}/><h2>Modèle local</h2><small>Ollama</small><button disabled={busy} onClick={()=>void detect()}>Détecter{local.some(m=>m.id===selected)&&<Check size={15}/>}</button></article>
 <article className="model-choice" data-selected={openai.some(m=>m.id===selected)}><KeyRound size={26}/><h2>Clé OpenAI</h2><small>Ta clé personnelle</small><button disabled={busy} onClick={()=>{if(openai.length&&!editingKey)void task(()=>choose(openai[0]));else setEditingKey(true);}}>Utiliser{openai.some(m=>m.id===selected)&&<Check size={15}/>}</button>{openai.length>0&&<button className="model-key-edit" disabled={busy} onClick={()=>setEditingKey(v=>!v)}>Modifier la clé</button>}</article>
 <article className="model-choice" data-selected={cloud.some(m=>m.id===selected)}><Cloud size={26}/><h2>Solar Cloud</h2><small>Gratuit</small><button disabled={busy} onClick={()=>void task(async()=>{const m=cloud.find(m=>/DeepSeek-V4-Flash/i.test(m.providerModelId??m.name))??cloud[0];if(!m)throw Error('Solar Cloud n’est pas configuré sur ce compte.');await choose(m);})}>Utiliser{cloud.some(m=>m.id===selected)&&<Check size={15}/>}</button></article>
 </div>{editingKey&&<form className="model-key-form" onSubmit={e=>{e.preventDefault();void connect();}}><label>Clé API OpenAI<input autoFocus type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} disabled={busy} placeholder="sk-…"/></label><button disabled={busy||!key.trim()}>Connecter</button><button type="button" disabled={busy} onClick={()=>{setKey('');setEditingKey(false);}}>Annuler</button></form>}
 <p className="model-current" role="status">{busy?'Connexion…':current&&currentProvider?`${currentProvider.protocol==='ollama'?'Local':isSolarCloudProvider(currentProvider)?'Solar Cloud':currentProvider.name} · ${current.name}`:'Aucun modèle sélectionné'}</p>{error&&<p role="alert" className="team-error">{error}</p>}</section>;
}
