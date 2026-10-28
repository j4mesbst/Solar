import type {Provider,Model} from '../../domain/types';
import {solarAgentStore} from '../../services/solarAgentStore';
import {runAgentMission} from '../../services/solarAgentRuntime';
import {jobs} from './store';
export {jobs};
export {controlJob,decideJobApproval,eventsSince} from './lifecycle';
/** Backend entry point, also usable by a future UI; never auto-grants permissions. */
export async function resumeAgentJob(id:string,providers:Provider[],models:Model[],signal:AbortSignal){
 const job=await jobs.get(id);if(!job)throw Error('Tâche introuvable.');if(job.runtime==='cloud')throw Error('Worker cloud non configuré.');
 const agent=(await solarAgentStore.snapshot()).agents.find(a=>a.id===job.agentId&&a.enabled);if(!agent)throw Error('Agent absent ou désactivé.');
 return runAgentMission({jobBudget:job.budgets,successCriteria:job.criteria,durableJobId:id,mission:job.checkpoint.mission,agent,providers,models,signal,conversationId:job.conversationId,serviceScope:job.constraints.services,readOnlyTools:job.constraints.readOnly});
}
