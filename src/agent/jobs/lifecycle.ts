import type {AgentJob,JobState} from './types';
import {JobBlocked} from './types';
import {jobs} from './store';
export const terminal=(state:JobState)=>['completed','cancelled'].includes(state);
const edges:Record<JobState,JobState[]>={queued:['planning','paused','cancelled','blocked'],planning:['running','verifying','paused','blocked','failed','cancelled','waiting_approval'],running:['verifying','waiting_approval','paused','blocked','failed','cancelled'],verifying:['waiting_approval','completed','blocked','failed','paused','cancelled','running'],waiting_approval:['running','paused','blocked','cancelled'],paused:['planning','cancelled'],blocked:['planning','cancelled'],failed:['planning','cancelled'],cancelled:[],completed:[]};
export function transition(job:AgentJob,state:JobState){if(job.state!==state&&!edges[job.state].includes(state))throw new JobBlocked('invalid-transition',`Transition ${job.state} → ${state} refusée.`);job.state=state;return job;}
export function fenced(job:AgentJob|undefined,token:string){if(!job||job.lease?.token!==token||job.lease.expiresAt<=Date.now())throw new JobBlocked('lease-lost','Le bail de cette tâche a expiré.');if(job.control)throw new JobBlocked(job.control,'Tâche suspendue par l’utilisateur.');return job;}
export async function controlJob(id:string,control:'pause'|'cancel'){
 return jobs.update(id,job=>{if(!job)throw Error('Tâche introuvable.');if(terminal(job.state))return job;job.control=control;transition(job,control==='cancel'?'cancelled':'paused');return job;},{type:control,cause:'Contrôle utilisateur persisté.'});
}
export async function decideJobApproval(id:string,approvalId:string,allowed:boolean){
 return jobs.update(id,job=>{if(!job)throw Error('Tâche introuvable.');const a=job.approvals.find(a=>a.id===approvalId);if(!a||a.state!=='pending'||a.expiresAt<=Date.now()||terminal(job.state)||job.control)throw Error('Validation absente, expirée ou annulée.');a.state=allowed?'approved':'denied';a.decidedAt=Date.now();return job;},{type:'approval-decision',cause:allowed?'Action exacte approuvée.':'Action refusée.'});
}
export async function eventsSince(id:string,cursor=0){return (await jobs.get(id))?.events.filter(e=>e.seq>cursor)??[];}
