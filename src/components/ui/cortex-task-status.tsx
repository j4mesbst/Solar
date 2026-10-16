import { useEffect, useState } from "react";
import { cortexStore } from "../../services/cortexStore";
import type { CortexTask } from "../../lib/cortex/types";
import { Button } from "./button";
export function CortexTaskStatus({ id, revision, phase, busy, resume }: { id:string;revision:number;phase?:string;busy:boolean;resume:()=>void }) {
  const [task,setTask]=useState<CortexTask>();
  useEffect(()=>{let live=true;void cortexStore.load(id).then(value=>{if(live)setTask(value);});return()=>{live=false;};},[id,phase,revision]);
  const best=task?.candidates.filter(c=>c.finished).sort((a,b)=>(b.score??0)-(a.score??0))[0]??task?.candidates[task.branch];
  const detail=task?.events.at(-1)?.detail;
  const minutes=task?.elapsedMs ? Math.floor(task.elapsedMs/60_000) : 0;
  return <div className="cortex-task-status">
    {task&&<p className="cortex-task-meta" aria-live="polite">{detail ?? "Cortex prépare la tâche"} · {task.generations} génération{task.generations>1?"s":""}{minutes?` · ${minutes} min` : ""}</p>}
    {!busy&&phase!=="completed"&&<Button variant="outline" className="small-button" onClick={resume}>Reprendre Cortex</Button>}
    {Boolean(best?.checks.length)&&<details><summary>Vérifications Cortex</summary><ul>{best!.checks.map((check,i)=><li key={i}><span>{check.status==="passed"?"Réussi":check.status==="failed"?"Échec":"Non effectué"} · {check.type}</span><p>{check.output}</p></li>)}</ul></details>}
  </div>;
}
