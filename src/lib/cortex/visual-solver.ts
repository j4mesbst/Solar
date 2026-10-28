import type { CortexVerification, RenderReport, VisualConstraint, InspectionOptions } from "./types.ts";

export function explicitConstraints(prompt:string,report:RenderReport):VisualConstraint[]{
  const match=prompt.match(/(?:sidebar|barre latérale)[^.!\n]{0,35}?(\d{2,4})\s*px/i);
  const sidebar=report.frames.at(-1)?.elements.find(element=>/aside|sidebar|#side\b/.test(element.selector));
  return match&&sidebar?[{id:"explicit-sidebar-width",selector:sidebar.selector,property:"width",expected:Number(match[1]),tolerance:6}]:[];
}

export function solveVisual(report:RenderReport,constraints:VisualConstraint[]):CortexVerification[]{
  return constraints.map(constraint=>{
    const frame=constraint.timestamp===undefined?report.frames.at(-1):report.frames.find(frame=>frame.timestamp===constraint.timestamp);
    const element=frame?.elements.find(element=>element.selector===constraint.selector);
    const actual=element?.[constraint.property];const known=typeof actual==="number";
    const delta=known?Math.abs(actual-constraint.expected):undefined;const success=delta!==undefined&&delta<=constraint.tolerance;
    return {type:element?"visual":"structure",validatorId:`geometry:${constraint.id}`,validatorVersion:"1",success,status:success?"passed":"failed",measurement:delta,
      qualityMetrics:delta===undefined?undefined:{absoluteError:delta},output:`${constraint.selector}.${constraint.property}: attendu ${constraint.expected} ±${constraint.tolerance}, observé ${known?actual:"élément absent"}.`,
      counterexamples:success?[]:[element?`${constraint.selector}: ${constraint.property}=${String(actual)}, attendu=${constraint.expected}`:`DOM absent : ${constraint.selector}. Restaurer React/HTML avant toute correction CSS.`]};
  });
}
export function inspectInteractions(report:RenderReport,options?:InspectionOptions):CortexVerification[]{
  if(!options?.interactions?.length)return [];
  const observed=report.interactions??[],success=observed.length===options.interactions.length&&observed.every(action=>action.success);
  return [{type:"structure",validatorId:"interaction-trigger",validatorVersion:"1",status:success?"passed":"failed",success,output:success?"Les interactions demandées ont été déclenchées sur leurs cibles.":`Interaction absente ou non déclenchée : ${options.interactions.map(action=>action.selector).join(", ")}.`}];
}
