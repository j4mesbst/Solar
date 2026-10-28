import {validateToolParameters} from '../../services/toolSchema.ts';
import type {CortexPluginTool} from './tool-runtime.ts';
export interface WorkflowRef {from:string;path:(string|number)[]}
export interface WorkflowNode {id:string;tool:string;arguments:Record<string,unknown>;dependsOn?:string[];each?:{from:string;path:(string|number)[];argument:string;field:(string|number)[];limit:number}}
export interface CompiledWorkflow {version:1;nodes:WorkflowNode[]}
export const workflowSchema={type:'object',properties:{version:{const:1},nodes:{type:'array',minItems:1,maxItems:24,items:{type:'object',properties:{id:{type:'string',pattern:'^[a-zA-Z][a-zA-Z0-9_]{0,39}$'},tool:{type:'string'},arguments:{type:'object'},dependsOn:{type:'array',maxItems:24,items:{type:'string'}},each:{type:'object',properties:{from:{type:'string'},path:{type:'array',maxItems:12,items:{type:['string','integer']}},argument:{type:'string'},field:{type:'array',maxItems:12,items:{type:['string','integer']}},limit:{type:'integer',minimum:1,maximum:40}},required:['from','path','argument','field','limit'],additionalProperties:false}},required:['id','tool','arguments'],additionalProperties:false}}},required:['version','nodes'],additionalProperties:false};
const bad=new Set(['__proto__','prototype','constructor']);
export function readWorkflowPath(value:unknown,path:(string|number)[]):unknown{
 if(path.length>12)throw Error('Chemin de donnée trop profond.');
 for(const part of path){if(typeof part!=='string'&&typeof part!=='number'||bad.has(String(part))||value===null||typeof value!=='object'||!Object.hasOwn(value,part))throw Error('Référence de résultat absente ou interdite.');value=(value as Record<string,unknown>)[part];}return value;
}
const isRef=(value:unknown):value is {$result:WorkflowRef}=>!!value&&typeof value==='object'&&Object.hasOwn(value,'$result');
function refs(value:unknown,depth=0):string[]{
 if(depth>20)throw Error('Arguments trop profonds.');
 if(isRef(value)){const r=value.$result;if(Object.keys(value).length!==1||!r||typeof r.from!=='string'||!Array.isArray(r.path)||Object.keys(r).some(k=>!['from','path'].includes(k)))throw Error('Référence invalide.');if(r.path.some(p=>bad.has(String(p))||!['string','number'].includes(typeof p)||(typeof p==='number'&&(!Number.isInteger(p)||p<0))))throw Error('Chemin interdit.');return[r.from];}
 if(Array.isArray(value))return value.flatMap(v=>refs(v,depth+1));
 if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>{if(bad.has(k))throw Error('Clé interdite.');return refs(v,depth+1);});return[];
}
export const workflowReadSafe=(tool:CortexPluginTool)=>tool.risk==='read'&&tool.externalEffects!==true&&!tool.permissions?.some(p=>/\.write$|execution/.test(p));
export function compileWorkflow(value:unknown,tools:CortexPluginTool[]):CompiledWorkflow{
 if(JSON.stringify(value).length>60000||validateToolParameters(value,workflowSchema).length)throw Error('Workflow hors schéma ou trop volumineux.');
 const flow=structuredClone(value) as CompiledWorkflow,ids=new Set(flow.nodes.map(n=>n.id));if(ids.size!==flow.nodes.length)throw Error('Étapes dupliquées.');
 for(const node of flow.nodes){const tool=tools.find(t=>t.name===node.tool);if(!tool||!workflowReadSafe(tool))throw Error('Un workflow compilé n’autorise que les lectures déclarées sans effet externe.');
  const needed=[...refs(node.arguments),...(node.each?[node.each.from]:[])];node.dependsOn=[...new Set([...(node.dependsOn??[]),...needed])];if(node.dependsOn.some(id=>!ids.has(id)||id===node.id))throw Error('Dépendance absente ou circulaire.');
  if(node.each){refs({$result:{from:node.each.from,path:node.each.path}});refs({$result:{from:node.each.from,path:node.each.field}});if(bad.has(node.each.argument))throw Error('Paramètre interdit.');}
  if(!needed.length&&validateToolParameters(node.arguments,tool.parameters).length)throw Error(`Paramètres statiques invalides : ${node.tool}.`);
 }
 const visiting=new Set<string>(),done=new Set<string>();const visit=(id:string)=>{if(visiting.has(id))throw Error('Cycle de workflow.');if(done.has(id))return;visiting.add(id);flow.nodes.find(n=>n.id===id)!.dependsOn!.forEach(visit);visiting.delete(id);done.add(id);};flow.nodes.forEach(n=>visit(n.id));return flow;
}
function resolve(value:unknown,results:Map<string,unknown>):unknown{
 if(isRef(value)){if(!results.has(value.$result.from))throw Error('Résultat requis non disponible.');return structuredClone(readWorkflowPath(results.get(value.$result.from),value.$result.path));}
 if(Array.isArray(value))return value.map(v=>resolve(v,results));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v,results)]));return value;
}
/** GTS 3: work-conserving, globally bounded read scheduler. Each foreach item
 * shares the same three slots as every other node; order is retained in output.
 * Expand and validate a ready frontier before dispatch. On failure/cancellation,
 * drain already-started work, then stop: no speculative requests or write retry. */
export async function executeWorkflow(value:CompiledWorkflow,tools:CortexPluginTool[],run:(tool:string,args:Record<string,unknown>)=>Promise<unknown>,signal:AbortSignal,concurrency=3){
 const flow=compileWorkflow(value,tools);
 concurrency=Math.max(1,Math.min(3,Number.isFinite(concurrency)?Math.floor(concurrency):1));
 const results=new Map<string,unknown>(),expanded=new Set<string>();let toolCalls=0;
 type Job={node:WorkflowNode;input:Record<string,unknown>;index:number;parallel:boolean};
 type Settlement={job:Job;value?:unknown;error?:unknown;failed:boolean};
 const pending:Job[]=[],running=new Map<Job,Promise<Settlement>>(),values=new Map<string,unknown[]>(),left=new Map<string,number>();
 try{
  while(results.size<flow.nodes.length){
   signal.throwIfAborted();
   const ready=flow.nodes.filter(n=>!expanded.has(n.id)&&n.dependsOn!.every(d=>results.has(d)));
   const batches=ready.map(node=>{
    const tool=tools.find(t=>t.name===node.tool)!,args=resolve(node.arguments,results) as Record<string,unknown>;
    let inputs:Record<string,unknown>[];
    if(node.each){const list=readWorkflowPath(results.get(node.each.from),node.each.path);if(!Array.isArray(list))throw Error('La source foreach n’est pas une liste.');if(list.length>node.each.limit)throw Error('Liste au-delà de la limite explicite : préciser ou paginer.');inputs=list.map(item=>({...args,[node.each!.argument]:readWorkflowPath(item,node.each!.field)}));}else inputs=[args];
    if(inputs.some(input=>validateToolParameters(input,tool.parameters).length))throw Error(`Résultat incompatible avec les paramètres : ${node.tool}.`);
    return inputs.map((input,index)=>({node,input,index,parallel:tool.parallelSafe===true}));
   });
   for(let n=0;n<ready.length;n++){const node=ready[n],count=batches[n].length;expanded.add(node.id);values.set(node.id,Array(count));left.set(node.id,count);if(!count)results.set(node.id,[]);}
   // Interleave ready maps so a large list does not monopolize the queue.
   for(let index=0;batches.some(batch=>index<batch.length);index++)for(const batch of batches)if(batch[index])pending.push(batch[index]);
   while(pending.length&&running.size<concurrency){
    signal.throwIfAborted();const job=pending[0];
    if(running.size&&(!job.parallel||[...running.keys()].some(j=>!j.parallel)))break;
    pending.shift();const work=Promise.resolve().then(()=>{signal.throwIfAborted();return run(job.node.tool,job.input);}).then(value=>({job,value,failed:false}),error=>({job,error,failed:true}));running.set(job,work);
    if(!job.parallel)break;
   }
   if(!running.size){if(pending.length||expanded.size<flow.nodes.length)throw Error('Workflow bloqué : dépendances non satisfaites.');continue;}
   const done=await Promise.race(running.values());running.delete(done.job);if(done.failed)throw done.error;
   signal.throwIfAborted();toolCalls++;const id=done.job.node.id;values.get(id)![done.job.index]=done.value;left.set(id,left.get(id)!-1);
   if(left.get(id)===0)results.set(id,done.job.node.each?values.get(id):values.get(id)![0]);
  }
 }catch(error){await Promise.allSettled(running.values());throw error;}
 return {results:Object.fromEntries(results),toolCalls};
}
