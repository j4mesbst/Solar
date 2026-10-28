import type { AgentVisualValidation, DomExpectation } from '../agent/types.ts';
import type { CortexVerification, DomObservation, EvidenceOrigin, InspectionOptions, RenderReport } from './types.ts';

export function freezeBehavior(previous:AgentVisualValidation|undefined,next:AgentVisualValidation){
  const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
  if(previous&&JSON.stringify(canonical(previous))!==JSON.stringify(canonical(next)))throw Error('Le contrat d’interaction est déjà fixé. Corrige le comportement; ne réécris pas les attentes après un échec.');
  return structuredClone(previous??next);
}
export function effectiveInspection(explicit?:InspectionOptions,generated?:AgentVisualValidation):InspectionOptions|undefined{
  if(!explicit&&!generated)return;
  // Explicit user/independent-checker scenarios always take precedence. A model
  // cannot disable motion measurements or replace those original assertions.
  const base={...generated,...explicit,reducedMotion:explicit?.reducedMotion??false};
  if(explicit?.interactions)base.interactions=explicit.interactions;
  if(explicit?.expectations)base.expectations=explicit.expectations;
  const selectors=[...new Set([...(explicit?.selectors??[]),...(base.expectations??[]).map(e=>e.selector),...(base.interactions??[]).flatMap(action=>(action.expect??[]).map(e=>e.selector))])].slice(0,24);
  return {...base,selectors};
}
const same=(expected:DomExpectation,observed?:DomObservation)=>{
  if(!observed)return false;
  if(!observed?.found)return expected.visible===false&&expected.text===undefined&&expected.value===undefined&&expected.attribute===undefined&&expected.style===undefined;
  const a=expected.attribute,present=a?Object.hasOwn(observed.attributes??{},a.name):false;
  return (expected.text===undefined||observed.text===expected.text)&&(expected.value===undefined||observed.value===expected.value)&&(expected.visible===undefined||observed.visible===expected.visible)&&(!a||(a.present===undefined||present===a.present)&&(a.value===undefined||present&&observed.attributes?.[a.name]===a.value))&&(!expected.style||Object.entries(expected.style).every(([key,value])=>observed.styles?.[key]===value));
};
export function verifyBehavior(report:RenderReport,options?:InspectionOptions,origin:EvidenceOrigin='user-requirement'):CortexVerification[]{
  const checks:CortexVerification[]=[];
  const inspect=(expected:DomExpectation,observed:DomObservation|undefined,key:string)=>{
    const invalid=observed?.found&&expected.value!==undefined&&observed.tag!==undefined&&!['input','textarea','select','option','button','progress','meter','li'].includes(observed.tag.toLowerCase())
      ||expected.attribute&&['open','hidden','disabled','checked','selected','multiple','required','readonly','autofocus'].includes(expected.attribute.name.toLowerCase())&&['true','false'].includes(expected.attribute.value??'');
    const success=!invalid&&same(expected,observed);
    const available=report.supported&&report.frames.length>0;
    checks.push({type:observed?.found?'tests':'structure',origin,hardConstraint:origin!=='model-suggestion',category:'functional',validatorId:`behavior:${key}:${expected.selector}`,validatorVersion:'2',status:!available||invalid?'unavailable':success?'passed':'failed',success:available&&success,output:`${invalid?'Scénario invalide (cible/propriété incompatible), pas un défaut de code. ':''}Interaction ${key} : attendu ${JSON.stringify(expected)}, observé ${JSON.stringify(observed??null)}.`,counterexamples:success||invalid?[]:[`Le comportement de ${expected.selector} ne satisfait pas l’attente après l’action observée.`]});
  };
  options?.interactions?.forEach((action,index)=>action.expect?.forEach((expected,i)=>inspect(expected,report.interactions?.[index]?.observations?.find(observed=>observed.selector===expected.selector),`action-${index}-${i}`)));
  const final=report.frames.at(-1);
  options?.expectations?.forEach((expected,index)=>{
    const element=final?.elements.find(element=>element.selector===expected.selector||element.aliases?.includes(expected.selector));
    inspect(expected,element?{selector:expected.selector,found:true,tag:element.tag,text:element.text,value:element.value,visible:element.visible??(element.opacity>.05&&element.width>0&&element.height>0),attributes:element.attributes,styles:element.styles}:final?{selector:expected.selector,found:false}:undefined,`final-${index}`);
  });
  return checks;
}
export function hasBehaviorObservations(report:RenderReport,options?:InspectionOptions){
  if(!report.supported||!report.frames.length)return false;
  const actions=options?.interactions??[];
  for(let index=0;index<actions.length;index++){
    const expected=actions[index],actual=report.interactions?.[index];
    if(!actual||actual.selector!==expected.selector||actual.success&&actual.type!==expected.type)return false;
    if(!actual.success)continue; // A measured missing trigger is a real failure.
    if(expected.expect?.some(e=>!actual.observations?.some(o=>o.selector===e.selector)))return false;
  }
  return (options?.expectations??[]).every(expected=>report.observedSelectors?.includes(expected.selector)||report.frames.at(-1)?.elements.some(e=>e.selector===expected.selector||e.aliases?.includes(expected.selector)));
}
/** Small, factual spatial observations for localized repair. No aesthetic score
 * is inferred from pixels, and these notes do not change validator outcomes. */
export function visualObservations(report:RenderReport){
  const final=report.frames.at(-1);if(!final)return '';
  const issues=(final.telemetry??[]).slice(0,6).map(issue=>{
    const selector=issue.selector.split(',')[0].trim(),element=final.elements.find(e=>e.selector===selector);
    return `${issue.selector}: ${issue.issue}, ${issue.detail}${element?`; boîte x=${Math.round(element.x)}, y=${Math.round(element.y)}, ${Math.round(element.width)}×${Math.round(element.height)}; police ${element.fontSize??'?'}px; vérifier le conteneur et sa règle de mise en page`:''}`;
  });
  return issues.length?`Observations WebKit localisées : ${issues.join(' | ')}`:'';
}
