import type {AgentMission} from './solarAgentStore';
export function latestFinishedReply(missions:AgentMission[],agentId:string){return missions.filter(m=>m.agentId===agentId&&!m.origin&&['completed','partial','waiting'].includes(m.status)&&!!m.result?.trim()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];}
