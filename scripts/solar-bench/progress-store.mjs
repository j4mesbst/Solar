import { mkdir,writeFile,rename } from 'node:fs/promises';
import { dirname } from 'node:path';
/** Serial, atomic snapshots so a second Terminal never reads half a JSON. */
export function createProgressStore(paths,identity,onProgress){
  let state={...identity};let queue=Promise.resolve();let warned=false;
  const publish=event=>{
    state={...state,...event,updatedAt:new Date().toISOString()};
    if(event.type==='start'){state.result=undefined;state.elapsedMs=0;}
    const snapshot=structuredClone(state);try{onProgress?.(snapshot);}catch{}
    queue=queue.then(async()=>{for(const path of paths){await mkdir(dirname(path),{recursive:true});const temporary=`${path}.${process.pid}.tmp`;await writeFile(temporary,JSON.stringify(snapshot));await rename(temporary,path);}}).catch(error=>{if(!warned){warned=true;console.error(`Suivi live indisponible : ${error.message}`);}});
  };
  publish.flush=()=>queue;
  return publish;
}
