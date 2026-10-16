import type { AgentFileChange, AgentProject } from "../agent/types.ts";
import type { CortexCriterion, CortexVerification } from "./types.ts";
import { safeProjectPath } from "../agent/actions.ts";
import { sourceHash } from "./semantic.ts";
import { canonical } from './experience.ts';

export interface TaskNode {
  id:string; objective:string; files:string[]; dependsOn:string[]; criteria:CortexCriterion[];
  status:"pending"|"active"|"verified";
  proof?:{sources:Record<string,string>; validators:string[];conditions?:string};
}
export interface TaskGraph {version:1; nodes:TaskNode[]}
const criterionSchema={type:"object",properties:{id:{type:"string"},kind:{type:"string",enum:["file","contains","check"]},target:{type:"string"},value:{type:"string"}},required:["id","kind","target"],additionalProperties:false};
export const taskGraphSchema={type:"object",properties:{steps:{type:"array",minItems:1,maxItems:8,items:{type:"object",properties:{id:{type:"string"},objective:{type:"string"},files:{type:"array",minItems:1,maxItems:8,items:{type:"string"}},dependsOn:{type:"array",maxItems:7,items:{type:"string"}},criteria:{type:"array",minItems:1,maxItems:8,items:criterionSchema}},required:["id","objective","files","dependsOn","criteria"],additionalProperties:false}}},required:["steps"],additionalProperties:false};

export function parseTaskGraph(value:unknown):TaskGraph{
  const steps=(value as {steps?:unknown})?.steps;
  if(!Array.isArray(steps)||!steps.length||steps.length>8)throw Error("Graphe invalide : une à huit étapes attendues.");
  const nodes:TaskNode[]=steps.map((raw,index)=>{
    if(!raw||typeof raw!=="object")throw Error("Étape du graphe invalide.");
    const node=raw as Record<string,unknown>;
    if(typeof node.id!=="string"||!/^[-\w]{1,50}$/.test(node.id)||typeof node.objective!=="string"||!node.objective.trim()||node.objective.length>500)throw Error("Identifiant ou objectif d’étape invalide.");
    if(!Array.isArray(node.files)||!node.files.length||node.files.length>8||node.files.some(path=>typeof path!=="string"||!safeProjectPath(path)))throw Error("Fichier d’étape hors projet.");
    if(!Array.isArray(node.dependsOn)||node.dependsOn.length>7||node.dependsOn.some(id=>typeof id!=="string"))throw Error("Dépendances invalides.");
    if(!Array.isArray(node.criteria)||!node.criteria.length||node.criteria.length>8)throw Error("Une étape doit avoir des critères vérifiables.");
    const criteria=node.criteria.map((rawCriterion,i)=>{
      const c=rawCriterion as CortexCriterion;
      if(!c||!['file','contains','check'].includes(c.kind)||typeof c.target!=="string"||c.target.length>240||c.kind==='check'&&!['build','tests','syntax','imports','structure','visual','temporal'].includes(c.target)||c.kind!=='check'&&!safeProjectPath(c.target)||c.kind==='contains'&&(typeof c.value!=="string"||!c.value.length||c.value.length>500))throw Error("Critère d’étape invalide.");
      return {id:`node-${index}-${i}`,kind:c.kind,target:c.target,...(c.value?{value:c.value}:{})};
    });
    return {id:node.id,objective:node.objective,files:node.files as string[],dependsOn:node.dependsOn as string[],criteria,status:'pending'};
  });
  const ids=new Set(nodes.map(node=>node.id));if(ids.size!==nodes.length)throw Error("Identifiants d’étapes dupliqués.");
  const visited=new Set<string>(),visiting=new Set<string>();
  const visit=(id:string)=>{if(visiting.has(id))throw Error("Cycle dans les dépendances du graphe.");if(visited.has(id))return;const node=nodes.find(node=>node.id===id);if(!node)throw Error("Dépendance d’étape absente.");visiting.add(id);node.dependsOn.forEach(visit);visiting.delete(id);visited.add(id);};
  nodes.forEach(node=>visit(node.id));return {version:1,nodes};
}
export function currentTaskNode(graph?:TaskGraph){
  if(!graph)return;
  return graph.nodes.find(node=>node.status!=='verified'&&node.dependsOn.every(id=>graph.nodes.find(parent=>parent.id===id)?.status==='verified'));
}
export function graphComplete(graph?:TaskGraph){return !graph||graph.nodes.every(node=>node.status==='verified');}

/** Reuse a node proof only for the exact file versions it observed. Dependent
 * proofs are invalidated transitively, even if their own files did not change. */
export async function verifyTaskGraph(graph:TaskGraph,changes:AgentFileChange[],checks:CortexVerification[],project:AgentProject,signal:AbortSignal){
  const staged=new Map(changes.map(change=>[change.path,change.after])),sources=new Map<string,string>();
  for(const path of [...new Set(graph.nodes.flatMap(node=>[...node.files,...node.criteria.filter(c=>c.kind!=='check').map(c=>c.target)]))]){
    signal.throwIfAborted();sources.set(path,staged.get(path)??(project.files.includes(path)?await project.readFile(path,signal):""));
  }
  const relevant=(node:TaskNode)=>checks.filter(check=>check.hardConstraint!==false&&(!check.file||node.files.includes(check.file))&&(['syntax','imports','structure'].includes(check.type)||node.criteria.some(c=>c.kind==='check'&&c.target===check.type)));
  const conditions=(node:TaskNode)=>sourceHash(canonical(relevant(node).map(check=>({type:check.type,id:check.validatorId,version:check.validatorVersion,environment:check.experience?.environment,parameters:check.experience?.comparisonKey})).sort((a,b)=>canonical(a).localeCompare(canonical(b)))));
  let invalidated=true;
  while(invalidated){invalidated=false;for(const node of graph.nodes)if(node.status==='verified'&&(!node.proof||node.proof.conditions!==conditions(node)||relevant(node).some(check=>check.status!=='passed')||Object.entries(node.proof.sources).some(([path,hash])=>sourceHash(sources.get(path)??"")!==hash)||node.dependsOn.some(id=>graph.nodes.find(parent=>parent.id===id)?.status!=='verified'))){node.status='pending';node.proof=undefined;invalidated=true;}}
  const results:CortexVerification[]=[];
  for(let count=0;count<graph.nodes.length;count++){
    const node=currentTaskNode(graph);if(!node)break;node.status='active';
    const nodeChecks=node.criteria.map(c=>{
      const matching=checks.filter(check=>check.type===c.target&&check.hardConstraint!==false);
      const present=staged.has(c.target)||project.files.includes(c.target);
      const passed=c.kind==='check'?matching.length>0&&matching.every(check=>check.status==='passed'):c.kind==='file'?present:present&&Boolean(c.value&&(sources.get(c.target)??'').includes(c.value));
      return {type:'intent' as const,validatorId:`graph:${node.id}:${c.id}`,validatorVersion:'1',status:passed?'passed' as const:'failed' as const,success:passed,output:`Étape ${node.id} (${node.objective}) : ${c.kind} ${c.target}${c.value?` contient ${JSON.stringify(c.value)}`:''} ${passed?'vérifié':'non satisfait'}.${c.kind==='file'?' Présence uniquement : ne prouve pas le résultat métier.':''}`,affectedFiles:node.files};
    });
    results.push(...nodeChecks);
    const blockers=checks.filter(check=>check.hardConstraint!==false&&['syntax','imports','structure'].includes(check.type)&&check.status!=='passed'&&(!check.file||node.files.includes(check.file)));
    if(nodeChecks.some(check=>!check.success)||blockers.length)break;
    node.status='verified';node.proof={sources:Object.fromEntries([...new Set([...node.files,...node.criteria.filter(c=>c.kind!=='check').map(c=>c.target)])].map(path=>[path,sourceHash(sources.get(path)??'')])),validators:nodeChecks.map(check=>check.validatorId),conditions:conditions(node)};
  }
  for(const node of graph.nodes.filter(node=>node.status==='verified'))for(const c of node.criteria){
    const id=`graph:${node.id}:${c.id}`;
    if(!results.some(check=>check.validatorId===id))results.push({type:'intent',validatorId:id,validatorVersion:'1',status:'passed',success:true,output:`Étape ${node.id} : preuve réutilisée sur sources inchangées.`,affectedFiles:node.files});
  }
  return results;
}
export function taskGraphContext(graph?:TaskGraph){
  const node=currentTaskNode(graph);if(!graph||!node)return '';
  return `\nÉTAPE ACTIVE DU GRAPHE : ${node.id} · ${node.objective}\nFichiers : ${node.files.join(', ')}. Critères : ${node.criteria.map(c=>`${c.kind}:${c.target}${c.value?`=${c.value}`:''}`).join('; ')}.\nÉtapes déjà vérifiées : ${graph.nodes.filter(n=>n.status==='verified').map(n=>n.id).join(', ')||'aucune'}. Traite cette étape puis laisse les vérifications décider de la suite. Ne déclare pas la tâche entière finie tant que le graphe reste incomplet.`;
}
