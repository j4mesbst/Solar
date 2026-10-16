import type { AgentFileChange, AgentProject } from '../agent/types.ts';
import { safeProjectPath } from '../agent/actions.ts';
import { canonical } from './experience.ts';

/** Task-local only. No reuse when a dependency cannot be read safely. */
export async function verificationSources(project:AgentProject,changes:AgentFileChange[],signal:AbortSignal){
  const proposed=new Map(changes.map(change=>[change.path,change.after]));
  const hashes:Record<string,string>={};
  for(const path of [...new Set([...project.files,...proposed.keys()])].sort()){
    signal.throwIfAborted();if(!safeProjectPath(path))return;
    try{
      if(!globalThis.crypto?.subtle)return;
      const content=proposed.get(path)??await project.readFile(path,signal);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
      hashes[path]=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    }catch(error){signal.throwIfAborted();return;}
  }
  return hashes;
}
export class VerificationCache<T>{
  private entries=new Map<string,T>();
  key(sources:Record<string,string>,conditions:unknown){return canonical({sources,conditions});}
  get(key:string){const value=this.entries.get(key);return value===undefined?undefined:structuredClone(value);}
  set(key:string,value:T){this.entries.set(key,structuredClone(value));while(this.entries.size>8)this.entries.delete(this.entries.keys().next().value!);}
}
