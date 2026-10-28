import type { CortexVerification, EvidenceOrigin } from './types.ts';

export interface EngineeringDiagnostic {id:string;priority:number;origin:EvidenceOrigin;blocking:boolean;status:string;file?:string;detail:string}
/** A shared queue, never three concurrent repair loops. Only measured failures
 * can block. Artistic suggestions retain their provenance and remain optional. */
export function engineeringDiagnostics(checks:CortexVerification[]):EngineeringDiagnostic[]{
  return checks.filter(check=>check.status!=='passed').map(check=>{
    const origin=check.origin??'deterministic';
    const blocking=check.hardConstraint!==false&&!['vision-advice','model-suggestion'].includes(origin);
    const priority=!blocking?5:['syntax','imports','build'].includes(check.type)||/ReferenceError|TypeError|SyntaxError/.test(check.output)?0:check.category==='functional'||check.type==='tests'?1:check.type==='structure'||check.type==='intent'?2:check.type==='temporal'?4:3;
    return {id:check.validatorId??`${check.type}:${check.file??'project'}`,priority,origin,blocking,status:check.status,file:check.file,detail:check.output.slice(0,500)};
  }).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id)).slice(0,8);
}
