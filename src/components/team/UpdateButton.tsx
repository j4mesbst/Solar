import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Download,LoaderCircle} from 'lucide-react';
export function UpdateButton({busy}:{busy:boolean}){
 const[version,setVersion]=useState(''),[installing,setInstalling]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!('__TAURI_INTERNALS__'in window))return;let live=true;const check=()=>void invoke<{version:string}|null>('update_check').then(u=>{if(live)setVersion(u?.version??'');}).catch(()=>{});check();const timer=setInterval(check,30*60*1000);window.addEventListener('focus',check);return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',check);};},[]);
 if(!version)return null;
 return <><button className="solar-update-button" aria-label={`Mettre à jour Solar vers ${version}`} title={busy?'Termine la tâche en cours avant la mise à jour':installing?'Téléchargement et installation…':`Mise à jour ${version}`} disabled={busy||installing} onClick={()=>{setInstalling(true);setError('');void invoke('update_install').catch(()=>{setInstalling(false);setError('Mise à jour impossible. Réessaie ou télécharge la dernière version sur GitHub.');});}}>{installing?<LoaderCircle size={18} className="messenger-spinner"/>:<Download size={18}/>}</button>{error&&<button className="solar-update-error" role="alert" onClick={()=>setError('')}>{error}</button>}</>;
}
