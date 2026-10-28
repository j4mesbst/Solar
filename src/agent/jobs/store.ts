import {currentAccountScope} from '../../services/accountScope';
import type {AgentJob,JobBackend} from './types';
const native=()=>typeof window!=='undefined'&&Boolean((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
const clone=<T>(v:T):T=>structuredClone(v);
/** IndexedDB preview has the same atomic revision contract as native SQLite. */
class BrowserBackend implements JobBackend {
 private db?:Promise<IDBDatabase>;
 private open(){return this.db??=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('solar-agent-jobs',1);request.onupgradeneeded=()=>request.result.createObjectStore('jobs',{keyPath:['ownerId','id']});request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});}
 async get(owner:string,id:string){const db=await this.open();return new Promise<AgentJob|undefined>((resolve,reject)=>{const r=db.transaction('jobs').objectStore('jobs').get([owner,id]);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async list(owner:string){const db=await this.open();return new Promise<AgentJob[]>((resolve,reject)=>{const r=db.transaction('jobs').objectStore('jobs').getAll();r.onsuccess=()=>resolve(r.result.filter((j:AgentJob)=>j.ownerId===owner));r.onerror=()=>reject(r.error);});}
 async cas(owner:string,id:string,expected:number,value:AgentJob,event:{type:string;cause:string}){const db=await this.open();return new Promise<AgentJob|undefined>((resolve,reject)=>{const tx=db.transaction('jobs','readwrite'),s=tx.objectStore('jobs'),r=s.get([owner,id]);let next:AgentJob|undefined;r.onsuccess=()=>{const previous=r.result as AgentJob|undefined;if((previous?.revision??0)!==expected)return;next=revision(value,previous,event);s.put(next);};tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Transaction annulée.'));});}
}
export function revision(value:AgentJob,previous:AgentJob|undefined,event:{type:string;cause:string}){const rev=(previous?.revision??0)+1,at=new Date().toISOString();return {...clone(value),revision:rev,updatedAt:at,checkpoint:{...value.checkpoint,revision:rev},events:[...(previous?.events??[]),{seq:rev,at,...event}]};}
class NativeBackend implements JobBackend {
 private async call<T>(owner:string,op:string,id?:string,expected?:number,value?:AgentJob,event?:{type:string;cause:string}){const {invoke}=await import('@tauri-apps/api/core');return invoke<T>('agent_jobs',{owner,op,id,expected,value,event});}
 list(owner:string){return this.call<AgentJob[]>(owner,'list');}
 async get(owner:string,id:string){return (await this.call<AgentJob|null>(owner,'get',id))??undefined;}
 async cas(owner:string,id:string,expected:number,value:AgentJob,event:{type:string;cause:string}){return (await this.call<AgentJob|null>(owner,'cas',id,expected,value,event))??undefined;}
}
let override:JobBackend|undefined;const browser=new BrowserBackend(),sqlite=new NativeBackend();
/** Dependency injection for isolated runtime tests; no fixture data in production. */
export function setJobBackendForTests(backend?:JobBackend){override=backend;}
const backend=()=>override??(native()?sqlite:browser);
export const jobs={
 async list(){const owner=currentAccountScope(),result=await backend().list(owner);if(owner!==currentAccountScope())throw Error('Compte modifié.');return result;},
 async get(id:string){const owner=currentAccountScope(),result=await backend().get(owner,id);if(owner!==currentAccountScope())throw Error('Compte modifié.');return result;},
 async update(id:string,fn:(job:AgentJob|undefined)=>AgentJob,event:{type:string;cause:string}){
  const owner=currentAccountScope();for(let attempt=0;attempt<12;attempt++){if(owner!==currentAccountScope())throw Error('Compte modifié.');const previous=await backend().get(owner,id),next=fn(clone(previous));if(next.ownerId!==owner||next.id!==id)throw Error('Propriétaire de tâche invalide.');next.updatedAt=new Date().toISOString();const saved=await backend().cas(owner,id,previous?.revision??0,next,event);if(saved){if(owner!==currentAccountScope())throw Error('Compte modifié.');if(typeof window!=='undefined')window.dispatchEvent(new Event('solar-jobs-updated'));return saved;}}
  throw Error('Conflit de tâche ; réessaie.');
 }
};
