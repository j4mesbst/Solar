import type {AgentMission,SolarAgent} from '../../services/solarAgentStore';
import type {ToolApproval,ToolDefinition} from '../../services/toolRegistry';
export type JobState='queued'|'planning'|'running'|'verifying'|'waiting_approval'|'paused'|'blocked'|'failed'|'cancelled'|'completed';
export interface JobEvent {seq:number;at:string;type:string;cause:string}
export interface JobStep {key:string;tool:string;identity:string;mutating:boolean;state:'intent'|'confirmed'|'uncertain';result?:unknown;verified:boolean;attempts:number;at:string}
export interface ApprovalRequest {id:string;fingerprint:string;request:ToolApproval;state:'pending'|'approved'|'denied';expiresAt:number;decidedAt?:number}
export interface ArtifactEvidence {kind:'tool-result'|'source'|'answer';reference:string;verified:boolean;at:string}
export interface JobCheckpoint {revision:number;mission:AgentMission;steps:JobStep[];evidence:ArtifactEvidence[]}
export interface AgentJob {
 version:1;id:string;ownerId:string;agentId:string;conversationId?:string;goal:string;state:JobState;runtime:'local'|'cloud';
 criteria?:import('./verification').SuccessPredicate[];profile:SolarAgent;profileFingerprint:string;constraints:{readOnly:boolean;services?:string[]};acceptance:'verified-tools'|'answer';
 revision:number;events:JobEvent[];checkpoint:JobCheckpoint;approvals:ApprovalRequest[];
 lease?:{token:string;expiresAt:number;heartbeatAt:number};control?:'pause'|'cancel';
 budgets:{maxCycles:number;maxToolCalls:number};usage:{cycles:number;toolCalls:number;computeMs:number;modelCalls:number;inputTokens:number;outputTokens:number};
 errors:{code:string;message:string;at:string}[];createdAt:string;updatedAt:string;
}
export interface JobBackend {list(owner:string):Promise<AgentJob[]>;get(owner:string,id:string):Promise<AgentJob|undefined>;cas(owner:string,id:string,expected:number,value:AgentJob,event:{type:string;cause:string}):Promise<AgentJob|undefined>}
export interface DurableToolGate {
 approve(request:ToolApproval,signal:AbortSignal):Promise<boolean>;
 execute(tool:ToolDefinition,input:unknown,identity:string,signal:AbortSignal,operation:()=>Promise<unknown>):Promise<unknown>;
}
export class JobBlocked extends Error {constructor(public code:string,message:string){super(message);this.name='JobBlocked';}}
