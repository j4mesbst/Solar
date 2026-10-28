import type { CortexVerification, RenderElement, RenderReport } from './types.ts';

export interface MotionContract {
  id:string;selector?:string;property:'x'|'y'|'width'|'height'|'opacity'|'transform'|'filter'|'raster';
  startMs:number;endMs:number;tolerance?:number;from?:number|string;to?:number|string;
  requireMovement?:boolean;settle?:boolean;reducedMotion?:boolean;
}
export interface RemotionInspection {entryPoint?:string;compositionId?:string;frames?:number[];exportVideo?:boolean}
export function motionGuidance(prompt:string,files:{path:string;content:string}[]){
  if(!/gsap|remotion|animation|motion|animé|transition/i.test(prompt))return '';
  let pkg:Record<string,any>={};try{pkg=JSON.parse(files.find(file=>file.path==='package.json')?.content??'{}');}catch{/* Excerpt: do not infer dependencies. */}
  const deps={...pkg.dependencies,...pkg.devDependencies};
  const parts=['MOUVEMENT : sépare déclencheur, états initial/final, durée et propriétés. Les instants capturés bornent le timing; ils ne prouvent pas une continuité entre deux images.'];
  if(/gsap/i.test(prompt)||deps.gsap)parts.push(`GSAP ${deps.gsap?'déclaré':'non confirmé; aucune installation automatique'} : timeline cohérente, nettoyage gsap.context/revert dans React, matchMedia pour prefers-reduced-motion. Pour une inspection déterministe d'un module ES, expose la timeline réellement créée dans globalThis.__cortexGsapTimeline; le moteur la pilote sans créer d'animation. Morphing/ScrollTrigger uniquement si plugins présents; pas de scroll simulé prétendu.`);
  if(/remotion/i.test(prompt)||deps.remotion)parts.push(`REMOTION ${deps.remotion?'déclaré':'non confirmé; aucune installation automatique'} : registerRoot + Composition avec id/FPS/durationInFrames/dimensions cohérents; Sequence en frames, useCurrentFrame/interpolate/spring. Évite Date.now, timers et animations CSS pour la vidéo déterministe. Le rendu local exige Node, renderer/bundler et un navigateur déjà disponibles ainsi qu'un consentement d'exécution; aucun MP4 sans export exécuté.`);
  return parts.join('\n');
}
export function validateMotionContracts(contracts:MotionContract[]){
  if(!Array.isArray(contracts)||contracts.length>24)throw Error('Trop de contrats temporels.');
  const ids=new Set<string>();
  for(const c of contracts){
    if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||!['x','y','width','height','opacity','transform','filter','raster'].includes(c.property)||!Number.isFinite(c.startMs)||!Number.isFinite(c.endMs)||c.startMs<0||c.endMs<=c.startMs||c.endMs>3_600_000||(c.property!=='raster'&&(typeof c.selector!=='string'||!c.selector||c.selector.length>160))||(c.tolerance!==undefined&&(!Number.isFinite(c.tolerance)||c.tolerance<0))||[c.from,c.to].some(v=>v!==undefined&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v))))throw Error('Contrat temporel invalide.');
    ids.add(c.id);
  }
}
function delta(a:unknown,b:unknown){
  if(typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b))return Math.abs(a-b);
  if(typeof a==='string'&&typeof b==='string')return a===b?0:1;
  if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.length&&a.every(Number.isFinite)&&b.every(Number.isFinite))return a.reduce((sum,n,i)=>sum+Math.abs(n-b[i]),0)/a.length/255;
  return undefined;
}
export function assessMotionContracts(report:RenderReport,contracts:MotionContract[]):CortexVerification[]{
  validateMotionContracts(contracts);
  return contracts.map(c=>{
    const tolerance=c.tolerance??(c.property==='raster'?.002:c.property==='opacity'?.015:typeof c.from==='string'||['transform','filter'].includes(c.property)?0:1);
    const sample=(time:number)=>report.frames.find(frame=>frame.timestamp===time);
    const value=(frame:RenderReport['frames'][number]|undefined)=>c.property==='raster'?frame?.raster:frame?.elements.find(e=>e.selector===c.selector||e.aliases?.includes(c.selector!))?.[c.property as keyof RenderElement];
    const first=sample(c.startMs),last=sample(c.endMs),a=value(first),b=value(last);
    const observed=delta(a,b),issues:string[]=[];
    let unavailable=!report.supported||observed===undefined;
    if(c.reducedMotion&&(!report.reducedMotionEmulated||duringReducedMissing(report,c.startMs,c.endMs)))unavailable=true;
    const during=report.frames.filter(frame=>frame.timestamp>=c.startMs&&frame.timestamp<=c.endMs);
    const movement=during.some(frame=>(delta(a,value(frame))??0)>tolerance);
    if(c.reducedMotion&&movement)issues.push('Mouvement observé malgré prefers-reduced-motion.');
    if(c.requireMovement&&!c.reducedMotion&&!movement)issues.push('Aucun mouvement mesuré dans la fenêtre demandée.');
    if(c.from!==undefined&&(delta(a,c.from)??Infinity)>tolerance)issues.push(`État initial ${String(a)} au lieu de ${c.from}.`);
    if(c.to!==undefined&&(delta(b,c.to)??Infinity)>tolerance)issues.push(`État final ${String(b)} au lieu de ${c.to}.`);
    if(c.settle){const after=report.frames.filter(frame=>frame.timestamp>c.endMs);if(!after.length)unavailable=true;else if(after.some(frame=>(delta(b,value(frame))??Infinity)>tolerance))issues.push('Mouvement encore observé après la fin demandée.');}
    const status=unavailable?'unavailable':issues.length?'failed':'passed';
    return {type:'temporal',origin:'user-requirement',validatorId:`v5-motion:${c.id}`,validatorVersion:'1',status,success:status==='passed',counterexamples:issues,output:`${c.selector??'image vidéo'}.${c.property} à ${c.startMs}–${c.endMs}ms : ${unavailable?'échantillons, cible ou émulation requis indisponibles':issues.join(' ')||'états et mouvement vérifiés sur les instants capturés'}. Pas de preuve entre les échantillons.`};
  });
}
function duringReducedMissing(report:RenderReport,start:number,end:number){return report.frames.filter(frame=>frame.timestamp>=start&&frame.timestamp<=end).some(frame=>frame.reducedMotion!==true);}
export function assessVideoMotion(report:RenderReport):CortexVerification[]{
  if(report.captureMode!=='remotion')return [];
  const frames=report.frames;
  if(frames.length<2)return [{type:'temporal',validatorId:'v5-video-motion',status:'unavailable',success:false,output:'Vidéo : deux images clés au minimum sont nécessaires pour observer le mouvement.'}];
  const first=frames[0];
  const known=frames.every(frame=>delta(first.raster,frame.raster)!==undefined);
  const moved=known&&frames.slice(1).some(frame=>(delta(first.raster,frame.raster)??0)>.002);
  return [{type:'temporal',validatorId:'v5-video-motion',validatorVersion:'1',status:!known?'unavailable':moved?'passed':'failed',success:moved,output:`Remotion : ${frames.length} images réellement rendues; différence raster ${known?(moved?'observée':'absente'):'indisponible'}. Ne prouve ni qualité artistique ni continuité.`}];
}
