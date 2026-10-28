import { mkdir,mkdtemp,readFile,rm,symlink,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname,join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { renderDirectory,SOLAR_ROOT } from './webkit.mjs';
import { safeProjectPath } from '../../src/lib/agent/actions.ts';

const exec=promisify(execFile);
const outcome=(type,success,output,id=type)=>({type,validatorId:`bench:${id}`,validatorVersion:'2',status:success?'passed':'failed',success,output});
async function projectDir(files){
  const dir=await mkdtemp(join(tmpdir(),'solar-bench-'));
  try{for(const [path,content] of Object.entries(files)){if(!safeProjectPath(path))throw Error('Chemin interdit dans le projet de test.');const target=join(dir,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,content);}return dir;}
  catch(error){await rm(dir,{recursive:true,force:true});throw error;}
}
export function inspectReport(report,rule){
  const checks=[];const final=report.frames.at(-1);
  checks.push({...outcome('visual',Boolean(report.supported&&final&&!report.errors.length),report.errors.join(' | ')||'Captures WebKit réelles.','webkit'),renderReport:report});
  if(!final)return checks;
  for(const selector of rule.selectors??[]){const tags=selector.split(',');const found=final.elements.some(e=>tags.some(tag=>e.tag===tag||e.selector.startsWith(tag+':')||e.selector===tag));checks.push(outcome('structure',found,`DOM requis : ${selector}.`,`dom:${selector}`));}
  if(rule.minButtons)checks.push(outcome('structure',final.elements.filter(e=>e.tag==='button'||e.selector.startsWith('button:')).length>=rule.minButtons,`${rule.minButtons} boutons mesurés requis.`,'button-count'));
  checks.push(outcome('visual',report.frames.every(f=>f.overflow<=2),'Absence de débordement horizontal.','overflow'));
  for(const expected of rule.expected??[]){
    const element=final.elements.find(e=>e.selector===expected.selector||e.tag===expected.selector);let success=Boolean(element);
    if(expected.text!==undefined)success&&=Boolean(element?.text?.includes(expected.text));
    if(expected.property)success&&=typeof element?.[expected.property]==='number'&&Math.abs(element[expected.property]-expected.value)<=(expected.tolerance??5);
    if(expected.visible)success&&=element?.opacity>.9&&element.width>0&&element.height>0;
    checks.push(outcome('visual',success,`${expected.selector}: attendu ${JSON.stringify(expected)}, observé ${JSON.stringify(element??null).slice(0,400)}`,`expected:${expected.selector}:${expected.property??'text'}`));
  }
  if(rule.layout){const sidebar=final.elements.find(e=>e.tag==='aside'||/^(aside|nav):|^#side/.test(e.selector));checks.push(outcome('visual',Boolean(sidebar&&Math.abs(sidebar.width-rule.layout.sidebarWidth)<=rule.layout.tolerance),`Largeur sidebar attendue ${rule.layout.sidebarWidth}px.`,'sidebar-width'));}
  if(rule.interactions?.length)checks.push(outcome('structure',report.interactions?.length===rule.interactions.length&&report.interactions.every(e=>e.success),'Interactions déclenchées et cibles présentes.','interactions'));
  if(rule.temporal){
    const first=report.frames[0];const moved=first.elements.filter(a=>report.frames.slice(1).some(frame=>{const b=frame.elements.find(e=>e.selector===a.selector);return b&&(Math.abs(a.x-b.x)>1||Math.abs(a.y-b.y)>1||Math.abs(a.opacity-b.opacity)>.02||a.transform!==b.transform||a.filter!==b.filter);}));
    checks.push(outcome('temporal',moved.length>=(rule.minMoved??1),`${moved.length} élément(s) avec mouvement observé sur ${report.frames.length} instants.`,'motion'));
    if(rule.motionTarget){const a=first.elements.find(e=>e.selector===rule.motionTarget),b=final.elements.find(e=>e.selector===rule.motionTarget);checks.push(outcome('temporal',Boolean(a&&b&&a.opacity<=.1&&b.opacity>=.95),`États d’opacité attendus 0→1 pour ${rule.motionTarget}; observé ${a?.opacity}→${b?.opacity}.`,'motion-endpoints'));}
  }
  return checks;
}
export async function validateFixture(fixture,changes,{signal,root=SOLAR_ROOT,render,referenceImage}={}){
  if(!changes.length)return [outcome('structure',false,'Aucune modification proposée.','changes')];
  const files={...fixture.files,...Object.fromEntries(changes.map(c=>[c.path,c.after]))};const dir=await projectDir(files),checks=[];const rule=fixture.validate;
  try{
    if(rule.kind==='swift'){
      await exec('/usr/bin/xcrun',['swiftc','-typecheck',join(dir,rule.target)],{timeout:60_000,signal});checks.push(outcome('build',true,'Compilation Swift réussie.'));
      if(rule.assert){await writeFile(join(dir,'Check.swift'),`${await readFile(join(dir,rule.target),'utf8')}\n${rule.assert}\n`);await exec('/usr/bin/xcrun',['swift',join(dir,'Check.swift')],{timeout:60_000,signal});checks.push(outcome('tests',true,'Assertions Swift réussies.'));}
    }else if(rule.kind==='node'){
      await writeFile(join(dir,'check.cjs'),rule.test);await exec(process.execPath,[join(dir,'check.cjs')],{cwd:dir,timeout:20_000,signal});checks.push(outcome('tests',true,'Assertions Node indépendantes exécutées.'));
    }else{
      let renderer=render?(_html,times,abort,reference,options)=>renderDirectory(dir,times,abort,{reference,...options}):undefined;
      if(rule.kind==='react'){
        if(files['package.json']!==fixture.files['package.json'])return [{...outcome('build',false,'Le manifeste de référence ne doit pas être modifié pour réussir le test.','manifest-protection'),status:'unavailable'}];
        await symlink(join(root,'node_modules'),join(dir,'node_modules'),'dir');
        const config=join(dir,'bench-vite.config.mjs');await writeFile(config,'export default {build:{outDir:"dist"}};');
        await exec(join(root,'node_modules/.bin/vite'),['build','--config',config],{cwd:dir,timeout:120_000,signal});checks.push(outcome('build',true,'Build Vite réel dans une copie isolée.'));
        renderer=(_html,times,abort,reference,options)=>renderDirectory(join(dir,'dist'),times,abort,{reference,...options});
      }
      if(renderer&&rule.render){
        const times=rule.times??(rule.temporal?[0,80,160,280,420,650,1000]:[0]);
        const options={interactions:rule.interactions,viewport:rule.viewport};
        const report=await renderer(files['index.html']??'',times,signal,referenceImage,options);checks.push(...inspectReport(report,rule));
        if(rule.responsive){const small=await renderer(files['index.html']??'',[1000],signal,undefined,{viewport:{width:390,height:844}});checks.push(outcome('visual',small.errors.length===0&&small.frames.length>0&&small.frames.every(f=>f.overflow<=2),'Viewport 390×844 vérifié.','responsive'));if(rule.mobileExpected)checks.push(...inspectReport(small,{expected:rule.mobileExpected}).filter(check=>!check.renderReport));}
        if(rule.closeInteractions){const closed=await renderer(files['index.html']??'',[1000],signal,undefined,{...options,interactions:rule.closeInteractions});const element=closed.frames.at(-1)?.elements.find(e=>e.selector===rule.closedSelector);checks.push(outcome('structure',Boolean(element&&(!element.width||!element.height||element.opacity<.01)),'Fermeture du dialogue effectivement observée.','dialog-close'));}
        if(rule.id==='ui-chat-interaction'){const input=report.frames.at(-1)?.elements.find(e=>e.selector==='#message');checks.push(outcome('structure',input?.value==='','Champ vidé après envoi.','input-reset'));}
        if(rule.reference&&report.referenceDifference!==undefined)checks.push(outcome('visual',report.referenceDifference<=.14,`Écart image normalisé ${report.referenceDifference.toFixed(3)} ≤ 0.14 (seuil technique, sans score esthétique).`,'reference-difference'));
        if(rule.reducedMotion){
          const reduced=await renderer(files['index.html']??'',[0,1000],signal,undefined,{...options,reducedMotion:true});
          const moving=inspectReport(reduced,{temporal:true}).find(c=>c.validatorId==='bench:motion');
          checks.push(outcome('temporal',reduced.frames.length===2&&reduced.errors.length===0&&!moving?.success,'Mouvement réduit émulé : aucun mouvement entre 0 et 1000 ms.','reduced-motion'));
        }
      }else checks.push({...outcome('visual',false,'Service WebKit indisponible.','webkit'),status:'unavailable'});
    }
  }catch(error){signal?.throwIfAborted();const detail=String(error?.stderr||error?.message||error).slice(0,2500);checks.push({...outcome(rule.kind==='node'||rule.kind==='swift'&&checks.some(c=>c.type==='build'&&c.success)?'tests':'build',false,detail,'execution'),status:!/[Aa]ssertion/.test(detail)&&/ENOENT|No such file|SDK.*not found|compiled module.*created by|module cache.*denied/i.test(detail)?'unavailable':'failed',counterexamples:[detail.split('\n').find(line=>/error|Assertion|expected/i.test(line))??detail.slice(0,300)]});}
  finally{await rm(dir,{recursive:true,force:true});}
  return checks;
}
