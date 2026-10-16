import type { CortexCandidate, CortexTask } from "./types.ts";
import { sourceHash } from "./semantic.ts";
import { stableDiagnostic } from "./reliability.ts";
import { checkKey } from './experience.ts';

export interface SolutionSearch {
  causes:Record<string,{observations:number; strategies:string[]}>;
  active?:{cause:string; strategy:string; detail:string; inspectionUsed?:boolean};
}
const id=checkKey;
export function dominates(before:CortexCandidate,after:CortexCandidate){
  const prior=before.checks.filter(check=>check.hardConstraint!==false&&check.comparable!==false),next=after.checks.filter(check=>check.hardConstraint!==false&&check.comparable!==false);
  if(prior.some(check=>check.status==='passed'&&!next.some(item=>id(item)===id(check)&&item.status==='passed')))return false;
  const failed=(checks:typeof prior)=>checks.filter(check=>check.status!=='passed').length;
  if(failed(next)<failed(prior))return true;
  if(failed(next)>failed(prior))return false;
  let better=false;
  for(const check of next){const old=prior.find(item=>id(item)===id(check));if(check.measurement!==undefined&&old?.measurement!==undefined){if(check.measurement>old.measurement+.001)return false;if(check.measurement<old.measurement-.001)better=true;}}
  return better;
}
/** A small repertoire of genuinely different recovery operations per observed
 * counterexample. This is not a task-wide generation/time budget. */
export function considerAlternative(task:CortexTask,candidate:CortexCandidate){
  const failures=candidate.checks.filter(check=>check.hardConstraint!==false&&check.status==='failed');
  if(!failures.length||!task.repairMemory?.noProgress)return;
  const cause=sourceHash(failures.map(check=>`${id(check)}:${check.measurement!==undefined?'contrainte mesurée':stableDiagnostic(check.output).replace(/(observé|observed|actual)[^\n]*/gi,'$1 [valeur courante]').replace(/(\.[cm]?[jt]sx?|\.swift|\.rs):\d+(?::\d+)?/g,'$1:[ligne]').slice(0,700)}`).sort().join('\n'));
  const search=task.solutionSearch??={causes:{}};
  const state=search.causes[cause]??={observations:0,strategies:[]};state.observations++;
  if(state.observations<2||task.repairMemory.noProgress<2)return;
  const strategies=[
    ['inspect','Réinspecte la source actuelle et la cible du contre-exemple avant toute édition; vérifie le chemin et le handler ou symbole responsable.'],
    ['replace-symbol','Abandonne le patch textuel précédent. Reconstruis uniquement le symbole ou la plage responsable avec l’empreinte courante; préserve les parties vérifiées.'],
    ['alternative','Le correctif local ne converge pas. Propose une implémentation plus simple du composant responsable, avec la même API et les mêmes critères; conserve les contraintes déjà réussies.'],
  ];
  const next=strategies.find(([strategy])=>!state.strategies.includes(strategy));
  if(!next)return {exhausted:true,detail:'Trois stratégies de reprise ont été proposées pour le même contre-exemple; les actions observées n’ont pas apporté d’amélioration mesurée.'};
  state.strategies.push(next[0]);state.observations=0;
  search.active={cause,strategy:next[0],detail:next[1]};
  const keys=Object.keys(search.causes);while(keys.length>16)delete search.causes[keys.shift()!];
  return {exhausted:false,detail:next[1]};
}
export function searchContext(task:CortexTask){return task.solutionSearch?.active?`\nAPPROCHE ALTERNATIVE ${task.solutionSearch.active.strategy} : ${task.solutionSearch.active.detail}`:'';}
