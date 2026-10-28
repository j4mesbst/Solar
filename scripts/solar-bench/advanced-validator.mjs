import {mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {safeProjectPath} from '../../src/lib/agent/actions.ts';
import {render,renderDirectory,SOLAR_ROOT} from './webkit.mjs';
import {advancedContracts} from './advanced-private.mjs';
import {scoreChecks} from './scoring.mjs';

const exec=promisify(execFile);
const assets=fileURLToPath(new URL('./assets/advanced/',import.meta.url));
const check=(criterionId,success,output,status=success?'passed':'failed',evidence)=>({type:criterionId,criterionId,validatorId:`advanced:${criterionId}`,validatorVersion:'3',status,success:status==='passed',output,evidence});
async function materialize(fixture,changes){
  const dir=await mkdtemp(join(tmpdir(),'solar-bench-advanced-'));
  const files={...fixture.files,...Object.fromEntries(changes.map(change=>[change.path,change.after]))};
  for(const [path,content] of Object.entries(files)){
    if(!safeProjectPath(path))throw Error(`Chemin de fixture interdit: ${path}`);
    const target=join(dir,path);await mkdir(dirname(target),{recursive:true});
    if(content==='__SOLAR_BENCH_REFERENCE__')await writeFile(target,await readFile(join(assets,fixture.referenceAsset)));
    else await writeFile(target,content);
  }
  return {dir,files};
}
const element=(report,selector)=>report.frames.at(-1)?.elements.find(item=>item.selector===selector||item.aliases?.includes(selector));
const sourceText=files=>Object.entries(files).filter(([path])=>/\.(?:ts|tsx|js|jsx|html|css)$/.test(path)).map(([path,value])=>`${path}\n${value}`).join('\n');
const movedCount=report=>{const first=report.frames[0];if(!first)return 0;return first.elements.filter(a=>report.frames.slice(1).some(frame=>{const b=frame.elements.find(item=>item.selector===a.selector);return b&&(Math.abs(a.x-b.x)>1||Math.abs(a.y-b.y)>1||Math.abs(a.opacity-b.opacity)>.03||a.transform!==b.transform||a.filter!==b.filter);})).length;};
const rasterDifference=(a,b)=>a&&b?a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/(a.length*255):0;

export async function validateAdvancedFixture(fixture,changes,{signal,root=SOLAR_ROOT,referenceImage,exportVideo=false,evidenceDir}={}){
  const contract=advancedContracts[fixture.id];if(!contract)throw Error(`Contrat Advanced absent: ${fixture.id}`);
  if(!changes.length){const checks=[check('build',false,'Aucune modification proposée.')];return {checks,score:scoreChecks(checks,contract.criteria)};}
  const protectedChange=changes.find(change=>change.path==='package.json'||/(?:^|\/)(?:vite|remotion)\.config\.|(?:^|\/)node_modules(?:\/|$)|package-lock\.json$/.test(change.path));
  if(protectedChange){const checks=[check('build',false,`Fichier d’infrastructure protégé: ${protectedChange.path}.`)];return {checks,score:scoreChecks(checks,contract.criteria)};}
  const started=Date.now(),checks=[];let workspace;
  try{
    workspace=await materialize(fixture,changes);const {dir,files}=workspace;
    const text=sourceText(files);
    if(contract.kind==='advanced-remotion'&&/https?:\/\/|\bfetch\s*\(/i.test(text))throw Error('Ressource réseau interdite dans une fixture Remotion locale.');
    if(fixture.id.includes('refactor')&&contract.sourceAssertions?.length){const missing=contract.sourceAssertions.filter(([pattern])=>!pattern.test(text)).map(([,label])=>label);checks.push(check('interfaces',missing.length===0,missing.length?`Propagation incomplète: ${missing.join(', ')}.`:'Types, statut et composants propagés.'));}
    else if(fixture.id.includes('recovery')&&contract.sourceAssertions?.length){const missing=contract.sourceAssertions.filter(([pattern])=>!pattern.test(text)).map(([,label])=>label);checks.push(check('state',missing.length===0,missing.length?`Réparation d’état incomplète: ${missing.join(', ')}.`:'Clé stable et suppression par identifiant.'));}
    else for(const [pattern,label] of contract.sourceAssertions??[])checks.push(check(label==='timeline GSAP'?'timeline':label==='échelonnement'?'stagger':'interfaces',pattern.test(text),`${label}: ${pattern}`));
    if(contract.kind==='advanced-remotion'){
      await symlink(join(root,'node_modules'),join(dir,'node_modules'),'dir');
      const out=await mkdtemp(join(tmpdir(),'solar-bench-remotion-output-'));
      try{
        const {renderRemotionProject}=await import('../../src-tauri/src/cortex-remotion.mjs');
        const report=await renderRemotionProject({root:dir,outputDir:out,entryPoint:'src/index.tsx',compositionId:contract.compositionId,frames:contract.frames,projectFiles:Object.keys(files),authorized:true,exportVideo,exportAuthorized:exportVideo});
        const metadata=report.composition;widthGuard(report);if(evidenceDir)await saveEvidence(report,evidenceDir,'remotion');
        checks.push(check('build',true,'Composition Remotion chargée et images clés rendues.'));
        checks.push(check('runtime',report.errors.length===0,report.errors.join(' | ')||'Aucune erreur de rendu.'));
        checks.push(check('metadata',metadata.width===1920&&metadata.height===1080&&metadata.fps===30&&metadata.durationInFrames===300,`Métadonnées: ${metadata.width}×${metadata.height}, ${metadata.fps} FPS, ${metadata.durationInFrames} frames.`));
        const diffs=report.frames.slice(1).map((frame,index)=>rasterDifference(report.frames[index].raster,frame.raster));
        const moving=diffs.filter(value=>value>.012).length;
        checks.push(check(fixture.id.endsWith('-ad')?'motion':'continuous',moving>=Math.max(2,Math.floor(diffs.length/2)),`${moving}/${diffs.length} transitions raster mesurées.`,undefined,{diffs}));
        checks.push(check(fixture.id.endsWith('-ad')?'sequences':'scenes',moving>=2,'Plusieurs scènes visuellement distinctes.'));
        checks.push(check('opacity',fixture.id.endsWith('transitions')&&/opacity|interpolate/i.test(text),'Animation d’opacité déclarée.'));
        checks.push(check('ending',text.includes(contract.requiredText),`Texte final « ${contract.requiredText} » présent dans la source vérifiée.`));
        const nonBlank=report.frames.every(frame=>frame.raster?.some(value=>value<248));checks.push(check('frames',nonBlank,'Toutes les images clés contiennent des pixels non blancs.'));
      }finally{await rm(out,{recursive:true,force:true});}
    }else{
      let renderRoot=workspace.dir;
      if(contract.kind==='advanced-react'||contract.kind==='advanced-gsap'){
        await symlink(join(root,'node_modules'),join(workspace.dir,'node_modules'),'dir');
        await exec(join(root,'node_modules/.bin/vite'),['build','--outDir','dist'],{cwd:workspace.dir,timeout:120_000,signal});
        if(contract.kind==='advanced-react')await exec(join(root,'node_modules/.bin/tsc'),['--noEmit','-p','tsconfig.app.json'],{cwd:workspace.dir,timeout:120_000,signal});
        renderRoot=join(workspace.dir,'dist');
      }
      checks.push(check('build',true,contract.kind==='advanced-html'?'Projet HTML chargé.':'Build local réussi.'));
      const options={viewport:contract.viewport,interactions:contract.interactions,selectors:contract.selectors,motionClock:contract.motionClock,transitionCapture:Boolean(contract.interactions?.length)};
      const report=await renderDirectory(renderRoot,contract.times??[0,1000],signal,{...options,reference:referenceImage});
      if(evidenceDir)await saveEvidence(report,evidenceDir,'webkit');
      checks.push(check('runtime',report.errors.length===0,report.errors.join(' | ')||'Aucune erreur runtime WebKit.'));
      const selectorsOk=(contract.selectors??[]).every(selector=>report.frames.at(-1)?.elements.some(item=>item.selector===selector||item.aliases?.includes(selector)));
      const structureId=fixture.id.includes('screenshot')?'regions':fixture.id.includes('responsive')?'semantics':fixture.id.includes('visual-correction')?'typography':fixture.id.includes('timeline')?'final':fixture.id.includes('interactive')?'motion':fixture.id.includes('refactor')?'render':fixture.id.includes('recovery')?'ui':'components';
      checks.push(check(structureId,selectorsOk,`Sélecteurs observés: ${(contract.selectors??[]).join(', ')}.`));
      if(fixture.id.includes('screenshot')){checks.push(check('structure',selectorsOk,'Les cinq régions fonctionnelles sont présentes.'));checks.push(check('hierarchy',/<h1\b/i.test(text)&&/<h2\b/i.test(text),'Hiérarchie h1/h2 présente dans le DOM.'));}
      if(fixture.id.includes('refactor'))checks.push(check('structure',selectorsOk,'Composants enrichis présents dans le rendu.'));
      if(contract.interactions){const ok=report.interactions?.length===contract.interactions.length&&report.interactions.every(item=>item.success&&item.readiness!=='timed-out');const id=fixture.id.includes('responsive')?'dialog':fixture.id.includes('correction')?'interaction':fixture.id.includes('recovery')?'add':fixture.id.includes('refactor')?'toggle':fixture.id.includes('interactive')?'menu':'navigation';checks.push(check(id,ok,`${report.interactions?.filter(item=>item.success).length??0}/${contract.interactions.length} interactions exécutées.`));}
      if(fixture.id.includes('dashboard')){checks.push(check('search',report.interactions?.some(item=>item.selector==='#search'&&item.success),'Recherche remplie.'));checks.push(check('filter',report.interactions?.some(item=>item.selector==='#status-filter'&&item.success),'Filtre appliqué.'));}
      if(fixture.id.includes('recovery')){checks.push(check('remove',report.interactions?.at(-1)?.success===true,'Suppression ciblée observée.'));checks.push(check('existing',element(report,'#remaining')?.text==='2','Les deux tâches existantes restent cohérentes après ajout/suppression.'));}
      if(fixture.id.includes('gsap-interactive')){const actions=report.interactions??[];checks.push(check('menu',actions[0]?.success&&actions[1]?.success&&actions[0]?.readiness!=='timed-out'&&actions[1]?.readiness!=='timed-out','Ouverture et fermeture du menu observées.'));checks.push(check('selection',actions[2]?.success&&actions[2]?.readiness!=='timed-out','Sélection de carte observée.'));checks.push(check('return',actions[3]?.success&&actions[3]?.readiness!=='timed-out','Retour à l’état initial observé.'));checks.push(check('repeat',actions.slice(0,2).every(item=>item?.success),'Deux actions opposées successives terminent correctement.'));}
      if(fixture.id.includes('refactor'))checks.push(check('preserve',Boolean(element(report,'#budget-total')),'Total toujours rendu.'));
      if(report.referenceComparison){const difference=report.referenceComparison.meanError;if(contract.improvementBaseline){const baseline=await render(fixture.files['index.html'],[0],signal,referenceImage,{viewport:contract.viewport});const before=baseline.referenceComparison?.meanError;const improved=Number.isFinite(before)&&difference<=contract.referenceThreshold&&difference<=before*.75;checks.push(check('improvement',improved,`Écart avant ${before?.toFixed(3)??'indisponible'}, après ${difference.toFixed(3)}; cible ≤ ${contract.referenceThreshold} et gain ≥ 25 %.`,undefined,{before,difference,cells:report.referenceComparison.cells}));checks.push(check('geometry',difference<=contract.referenceThreshold,`Écart final ${difference.toFixed(3)} ≤ ${contract.referenceThreshold}.`));}else checks.push(check('geometry',difference<=contract.referenceThreshold,`Écart raster ${difference.toFixed(3)} ≤ ${contract.referenceThreshold}.`,undefined,{difference,cells:report.referenceComparison.cells}));if(contract.regions)checks.push(check('palette',report.referenceComparison.cells.filter(cell=>cell.error<=.28).length>=12,'Au moins 12/16 régions dans la tolérance.'));}
      if(contract.times){const moved=movedCount(report);checks.push(check(fixture.id.includes('timeline')?'movement':'motion',moved>=(contract.minMoved??1),`${moved} éléments animés observés.`));}
      if(contract.mobile){const mobile=await renderDirectory(renderRoot,[1000],signal,{viewport:{width:390,height:844},selectors:contract.selectors});const ok=mobile.errors.length===0&&mobile.frames.every(frame=>frame.overflow<=2);checks.push(check('responsive',ok,'Viewport mobile 390×844 sans débordement.'));if(fixture.id.includes('responsive')){checks.push(check('mobile',ok&&!element(mobile,'#sidebar')?.visible&&Boolean(element(mobile,'#mobile-nav')?.visible),'Navigation mobile adaptée.'));checks.push(check('desktop',element(report,'#sidebar')?.width>=220&&element(report,'#sidebar')?.width<=260,'Sidebar bureau mesurée.'));checks.push(check('overflow',ok,'Absence de débordement horizontal.'));}}
      if(contract.reducedMotion){const reduced=await renderDirectory(renderRoot,[0,1000],signal,{...options,reducedMotion:true,interactions:undefined});checks.push(check('reduced',reduced.errors.length===0&&movedCount(reduced)===0,'Mouvement réduit: aucun déplacement temporel.'));}
    }
    checks.push(check('efficiency',Date.now()-started<120_000,`Validation en ${Date.now()-started} ms.`));
  }catch(error){signal?.throwIfAborted();checks.push(check(checks.some(item=>item.criterionId==='build'&&item.status==='passed')?'runtime':'build',false,String(error?.stderr||error?.message||error).slice(0,2500),/ENOENT|module not found|Navigateur local absent/i.test(String(error))?'unavailable':'failed'));}
  finally{if(workspace)await rm(workspace.dir,{recursive:true,force:true});}
  const deduped=[...new Map(checks.map(item=>[item.criterionId,item])).values()];return {checks:deduped,score:scoreChecks(deduped,contract.criteria),evidenceDir};
}
function widthGuard(report){if(!report?.composition)throw Error('Composition Remotion non mesurable.');}
async function saveEvidence(report,directory,prefix){await mkdir(directory,{recursive:true});for(const frame of report.frames??[]){if(!frame.image)continue;const [header,base64]=frame.image.split(',');const extension=header.includes('png')?'png':'jpg';await writeFile(join(directory,`${prefix}-${Math.round(frame.timestamp)}.${extension}`),Buffer.from(base64,'base64'));}await writeFile(join(directory,`${prefix}-measurements.json`),JSON.stringify({...report,frames:(report.frames??[]).map(({image,...frame})=>frame)},null,2));}
