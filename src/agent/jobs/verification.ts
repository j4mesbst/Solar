import type {AgentJob} from './types';
import {canonical} from './gateway';
export interface SuccessPredicate {id:string;tool:string;path:(string|number)[];operator:'exists'|'equals'|'contains';value?:unknown}
export function checkPredicates(job:AgentJob){
 return (job.criteria??[]).map(criterion=>{
  const results=job.checkpoint.steps.filter(s=>s.tool===criterion.tool&&s.state==='confirmed'&&s.verified);
  const valid=criterion.path.length<=12&&criterion.path.every(p=>typeof p==='number'?Number.isSafeInteger(p)&&p>=0:typeof p==='string'&&!['__proto__','constructor','prototype'].includes(p));
  const passed=valid&&results.some(s=>{let value=s.result;for(const part of criterion.path){if(!value||typeof value!=='object'||!Object.hasOwn(value,part))return false;value=(value as Record<string,unknown>)[part];}return criterion.operator==='exists'?value!==null&&value!==undefined:criterion.operator==='equals'?canonical(value)===canonical(criterion.value):criterion.operator==='contains'?typeof value==='string'&&typeof criterion.value==='string'&&value.includes(criterion.value):false;});
  return {id:criterion.id,passed};
 });
}
