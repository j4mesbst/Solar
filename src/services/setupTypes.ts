import type {MascotId} from './solarAgentStore';
export interface SetupAgent {key:string;existingAgentId?:string;name:string;mascot:MascotId;role:string;goal:string;services:string[];cadence:'daily'|'weekly'}
export interface SetupProposal {id:string;summary:string;agents:SetupAgent[];manager:SetupAgent}
export interface SetupState {version:1;managerAgentId?:string;autonomy?:boolean;step:number;description:string;proposal?:SetupProposal;completedAt?:string;created:Record<string,string>}
export interface TeamTask {id:string;managerId:string;assigneeId:string;instruction:string;status:'queued'|'running'|'completed'|'blocked'|'failed';missionId?:string;result?:string;createdAt:string;updatedAt:string}
export interface ManagerGrant {agentId:string;instruction:string;goal:string;cadence:'daily'|'weekly';providerId:string;modelId:string;connections:Record<string,string>}
export interface TeamManager {initiativePlan?:{at:string;modelId:string;assignments:{agentId:string;reason:string}[]};agentId:string;enabled:boolean;nextCheckAt:string;grants:ManagerGrant[];lastCheckAt?:string;lastReport?:string;lastDay?:string;checksToday?:number;tasks:TeamTask[]}
