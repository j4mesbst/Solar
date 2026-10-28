import {currentAccountScope} from './accountScope.ts';
const active=new Set<string>();
/** Native OS file locks disappear on process death. A resumed workspace cannot
 * run beside an existing owner; uncertain writes still use their durable receipts. */
export async function acquireMissionLease(id:string,maxConcurrent=Infinity):Promise<()=>Promise<void>>{
 const account=currentAccountScope(),key=`${account}:${id}`;
 if(active.has(key))throw Error('Une mission est déjà en cours dans ce dossier.');
 if([...active].filter(k=>k.startsWith(account+':')).length>=maxConcurrent)throw Error('Le nombre de missions simultanées de ton offre est atteint. Attends la fin d’une mission ou consulte Abonnement.');
 active.add(key);let native=false;
 try{if(typeof window!=='undefined'&&(window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__){native=true;const {invoke}=await import('@tauri-apps/api/core');if(!await invoke<boolean>('mission_lock',{account,key:id}))throw Error('Une mission est déjà en cours dans ce dossier.');}}
 catch(e){active.delete(key);throw e;}
 return async()=>{try{if(native){const {invoke}=await import('@tauri-apps/api/core');await invoke('mission_unlock',{account,key:id});}}finally{active.delete(key);}};
}
